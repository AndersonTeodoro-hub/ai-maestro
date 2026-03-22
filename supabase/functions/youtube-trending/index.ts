import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const YOUTUBE_API_KEY = "AIzaSyA_7N4dRvk8mRNeeNVEFJH7VyUO89Wddok";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { niche, platform, maxResults = 10 } = await req.json();
    if (!niche) {
      return new Response(JSON.stringify({ error: "Niche is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build multiple search queries for better viral results
    const baseNiche = niche.toLowerCase().trim();
    const platformTag = platform === "TikTok" ? "tiktok" : platform === "Instagram Reels" ? "reels" : platform === "YouTube Shorts" ? "shorts" : "";

    const searchQueries = [
      `${baseNiche} viral ${platformTag} 2026`,
      `${baseNiche} trending ${platformTag}`,
      `${baseNiche} viral video`,
    ];

    console.log("[YOUTUBE] Searching with queries:", searchQueries);

    let allVideoIds: string[] = [];

    // Run multiple searches to get better results
    for (const query of searchQueries) {
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.set("key", YOUTUBE_API_KEY);
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("order", "viewCount");
      searchUrl.searchParams.set("maxResults", "10");
      searchUrl.searchParams.set("publishedAfter", getDateDaysAgo(30));
      searchUrl.searchParams.set("videoDefinition", "high");

      const searchResp = await fetch(searchUrl.toString());
      if (!searchResp.ok) continue;

      const searchData = await searchResp.json();
      const ids = (searchData.items || []).map((item: any) => item.id.videoId).filter(Boolean);
      allVideoIds.push(...ids);
    }

    // Remove duplicates
    allVideoIds = [...new Set(allVideoIds)];

    if (allVideoIds.length === 0) {
      return new Response(JSON.stringify({ videos: [], message: "No viral videos found for this niche" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get video statistics (views, likes, comments)
    // Process in chunks of 50 (API limit)
    const chunks = [];
    for (let i = 0; i < allVideoIds.length; i += 50) {
      chunks.push(allVideoIds.slice(i, i + 50));
    }

    let allVideos: any[] = [];

    for (const chunk of chunks) {
      const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      statsUrl.searchParams.set("key", YOUTUBE_API_KEY);
      statsUrl.searchParams.set("id", chunk.join(","));
      statsUrl.searchParams.set("part", "snippet,statistics,contentDetails");

      const statsResp = await fetch(statsUrl.toString());
      if (!statsResp.ok) continue;
      const statsData = await statsResp.json();

      const videos = (statsData.items || []).map((video: any) => ({
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description?.slice(0, 200) || "",
        channel: video.snippet.channelTitle,
        publishedAt: video.snippet.publishedAt,
        thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || "",
        url: `https://www.youtube.com/watch?v=${video.id}`,
        shortUrl: `https://youtu.be/${video.id}`,
        views: parseInt(video.statistics.viewCount || "0"),
        likes: parseInt(video.statistics.likeCount || "0"),
        comments: parseInt(video.statistics.commentCount || "0"),
        duration: parseDuration(video.contentDetails.duration),
      }));

      allVideos.push(...videos);
    }

    // Filter: minimum 10K views to ensure truly viral content
    const MIN_VIEWS = 10000;
    let filtered = allVideos.filter((v: any) => v.views >= MIN_VIEWS);

    // If not enough results with 10K+, lower threshold to 1K
    if (filtered.length < 3) {
      filtered = allVideos.filter((v: any) => v.views >= 1000);
    }

    // If still not enough, use all results
    if (filtered.length < 3) {
      filtered = allVideos;
    }

    // Sort by views (highest first) and take top results
    filtered.sort((a: any, b: any) => b.views - a.views);
    filtered = filtered.slice(0, Math.min(maxResults, 10));

    console.log(`[YOUTUBE] Found ${allVideos.length} total, ${filtered.length} after filtering for "${niche}"`);

    return new Response(JSON.stringify({ videos: filtered, query: searchQueries.join(" | ") }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[YOUTUBE] Error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function parseDuration(iso: string): string {
  // Convert ISO 8601 duration (PT1M30S) to readable format
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const h = match[1] ? `${match[1]}:` : "";
  const m = match[2] || "0";
  const s = (match[3] || "0").padStart(2, "0");
  return h ? `${h}${m.padStart(2, "0")}:${s}` : `${m}:${s}`;
}
