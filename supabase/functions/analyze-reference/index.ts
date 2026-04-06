// analyze-reference — YouTube analysis, website scraping, Google search
// No external imports — Deno built-in + fetch only

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Auth helper ──
async function getUser(authHeader: string, supabaseUrl: string, serviceKey: string) {
  const token = authHeader.replace("Bearer ", "");
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": serviceKey,
    },
  });
  if (!resp.ok) return null;
  return resp.json();
}

// ── YouTube helpers ──
function extractVideoId(url: string): string | null {
  // youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, youtube.com/embed/ID
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/(?:shorts|embed)\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function parseDuration(iso: string): string {
  // PT1H2M30S → "1:02:30", PT5M10S → "5:10"
  const h = iso.match(/(\d+)H/)?.[1] ?? "";
  const m = iso.match(/(\d+)M/)?.[1] ?? "0";
  const s = iso.match(/(\d+)S/)?.[1] ?? "0";
  const sec = s.padStart(2, "0");
  if (h) return `${h}:${m.padStart(2, "0")}:${sec}`;
  return `${m}:${sec}`;
}

async function analyzeYouTube(url: string, apiKey: string) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Could not parse YouTube video ID from URL");

  // Fetch video details
  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`;
  const detailsResp = await fetch(detailsUrl);
  if (!detailsResp.ok) {
    const err = await detailsResp.text();
    throw new Error(`YouTube API error: ${err}`);
  }
  const detailsData = await detailsResp.json();
  const item = detailsData.items?.[0];
  if (!item) throw new Error("Video not found");

  const snippet = item.snippet;
  const stats = item.statistics;
  const contentDetails = item.contentDetails;

  // Try to fetch captions
  let transcript = "";
  try {
    // List available caption tracks
    const capsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    const capsResp = await fetch(capsUrl);
    if (capsResp.ok) {
      const capsData = await capsResp.json();
      const tracks = capsData.items ?? [];
      // Prefer manual captions, then auto-generated
      const manual = tracks.find((t: { snippet: { trackKind: string } }) => t.snippet.trackKind === "standard");
      const auto = tracks.find((t: { snippet: { trackKind: string } }) => t.snippet.trackKind === "asr");
      const trackId = manual?.id ?? auto?.id;

      if (trackId) {
        // Note: downloading captions requires OAuth — provide track info instead
        const trackSnippet = (manual ?? auto)?.snippet;
        transcript = `[Captions available: ${trackSnippet?.language ?? "unknown"}, type: ${trackSnippet?.trackKind ?? "unknown"}. Caption download requires OAuth authentication.]`;
      } else {
        transcript = "[No captions available for this video]";
      }
    }
  } catch {
    transcript = "[Could not fetch caption info]";
  }

  return {
    videoId,
    title: snippet.title ?? "",
    description: snippet.description ?? "",
    tags: snippet.tags ?? [],
    duration: parseDuration(contentDetails.duration ?? "PT0S"),
    views: Number(stats.viewCount ?? 0),
    likes: Number(stats.likeCount ?? 0),
    transcript,
  };
}

// ── Website analysis ──
async function analyzeWebsite(url: string) {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SavvyOwl/1.0)",
      "Accept": "text/html",
    },
    redirect: "follow",
  });
  if (!resp.ok) throw new Error(`Failed to fetch URL: ${resp.status}`);

  const html = await resp.text();

  // Extract meta tags
  const getMetaContent = (nameOrProp: string): string => {
    // Match both name="..." and property="..."
    const re = new RegExp(
      `<meta\\s+(?:[^>]*?)(?:name|property)=["']${nameOrProp}["']\\s+content=["']([^"']*)["']`,
      "i"
    );
    const re2 = new RegExp(
      `<meta\\s+content=["']([^"']*)["']\\s+(?:[^>]*?)(?:name|property)=["']${nameOrProp}["']`,
      "i"
    );
    return html.match(re)?.[1] ?? html.match(re2)?.[1] ?? "";
  };

  const ogTitle = getMetaContent("og:title");
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
  const title = ogTitle || titleTag;

  const ogDesc = getMetaContent("og:description");
  const metaDesc = getMetaContent("description");
  const description = ogDesc || metaDesc;

  const image = getMetaContent("og:image");

  // Extract body text (strip tags, scripts, styles)
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Limit to 3000 chars
  if (content.length > 3000) {
    content = content.slice(0, 3000) + "...";
  }

  return { title, description, content, image };
}

// ── Google Custom Search ──
async function searchContext(query: string, apiKey: string, cx: string) {
  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    num: "5",
  });
  const resp = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Google Search API error: ${err}`);
  }
  const data = await resp.json();
  const results = (data.items ?? []).map((item: { title: string; snippet: string; link: string }) => ({
    title: item.title ?? "",
    snippet: item.snippet ?? "",
    link: item.link ?? "",
  }));
  return { results };
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY") ?? "";

    // Auth check
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "No auth" }, 401);

    const user = await getUser(authHeader, supabaseUrl, serviceKey);
    if (!user?.id) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, url, query } = body;

    if (action === "analyze-youtube") {
      if (!url) return json({ error: "Missing url" }, 400);
      if (!googleApiKey) return json({ error: "GOOGLE_API_KEY not configured" }, 500);
      const result = await analyzeYouTube(url, googleApiKey);
      return json(result);
    }

    if (action === "analyze-website") {
      if (!url) return json({ error: "Missing url" }, 400);
      const result = await analyzeWebsite(url);
      return json(result);
    }

    if (action === "search-context") {
      if (!query) return json({ error: "Missing query" }, 400);
      if (!googleApiKey) return json({ error: "GOOGLE_API_KEY not configured" }, 500);
      const cx = Deno.env.get("GOOGLE_SEARCH_CX") ?? "";
      if (!cx) return json({ error: "GOOGLE_SEARCH_CX not configured. Create a Programmable Search Engine at https://programmablesearchengine.google.com/ and set the cx ID." }, 500);
      const result = await searchContext(query, googleApiKey, cx);
      return json(result);
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return json({ error: msg }, 500);
  }
});
