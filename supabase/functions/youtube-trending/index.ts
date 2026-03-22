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

    // Build search query based on niche and platform
    const platformQueries: Record<string, string> = {
      "TikTok": `${niche} viral tiktok 2026`,
      "Instagram Reels": `${niche} viral reels 2026`,
      "YouTube Shorts": `${niche} viral shorts 2026`,
      "YouTube": `${niche} viral 2026`,
    };

    const searchQuery = platformQueries[platform] || `${niche} viral 2026`;

    // Search YouTube for viral videos (sorted by view count, published recently)
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("key", YOUTUBE_API_KEY);
    searchUrl.searchParams.set("q", searchQuery);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("order", "viewCount");
    searchUrl.searchParams.set("maxResults", String(Math.min(maxResults, 10)));
    searchUrl.searchParams.set("publishedAfter", getDateDaysAgo(7));
    searchUrl.searchParams.set("relevanceLanguage", "pt");
    searchUrl.searchParams.set("videoDefinition", "high");

    console.log("[YOUTUBE] Searching:", searchQuery);

    const searchResp = await fetch(searchUrl.toString());
    if (!searchResp.ok) {
      const errText = await searchResp.text();
      console.error("[YOUTUBE] Search error:", errText);
      return new Response(JSON.stringify({ error: "YouTube search failed", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchData = await searchResp.json();
    const videoIds = (searchData.items || []).map((item: any) => item.id.videoId).filter(Boolean);

    if (videoIds.length === 0) {
      return new Response(JSON.stringify({ videos: [], message: "No viral videos found for this niche" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get video statistics (views, likes, comments)
    const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    statsUrl.searchParams.set("key", YOUTUBE_API_KEY);
    statsUrl.searchParams.set("id", videoIds.join(","));
    statsUrl.searchParams.set("part", "snippet,statistics,contentDetails");

    const statsResp = await fetch(statsUrl.toString());
    const statsData = await statsResp.json();

    // Build response with video details
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

    // Sort by views (highest first)
    videos.sort((a: any, b: any) => b.views - a.views);

    console.log(`[YOUTUBE] Found ${videos.length} videos for "${niche}"`);

    return new Response(JSON.stringify({ videos, query: searchQuery }), {
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
