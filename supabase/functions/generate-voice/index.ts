const GEMINI_VOICES = [
  { id: "Charon", name: "Charon", gender: "Male", style: "Informative" },
  { id: "Kore", name: "Kore", gender: "Female", style: "Firm" },
  { id: "Puck", name: "Puck", gender: "Male", style: "Upbeat" },
  { id: "Zephyr", name: "Zephyr", gender: "Female", style: "Bright" },
  { id: "Fenrir", name: "Fenrir", gender: "Male", style: "Excitable" },
  { id: "Leda", name: "Leda", gender: "Female", style: "Youthful" },
  { id: "Orus", name: "Orus", gender: "Male", style: "Firm" },
  { id: "Aoede", name: "Aoede", gender: "Female", style: "Breezy" },
  { id: "Algieba", name: "Algieba", gender: "Male", style: "Smooth" },
  { id: "Despina", name: "Despina", gender: "Female", style: "Smooth" },
  { id: "Gacrux", name: "Gacrux", gender: "Male", style: "Mature" },
  { id: "Umbriel", name: "Umbriel", gender: "Male", style: "Easy-going" },
  { id: "Vindemiatrix", name: "Vindemiatrix", gender: "Female", style: "Gentle" },
  { id: "Sadachbia", name: "Sadachbia", gender: "Male", style: "Lively" },
  { id: "Pulcherrima", name: "Pulcherrima", gender: "Female", style: "Forward" },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = authHeader.replace("Bearer ", "");

    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!userResp.ok) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userData = await userResp.json();
    if (!userData?.id) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { text, voiceId, action, provider, elevenLabsKey, googleApiKey } = body;

    // List voices
    if (action === "list-voices") {
      if (provider === "elevenlabs" && elevenLabsKey) {
        const resp = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": elevenLabsKey } });
        if (!resp.ok) return new Response(JSON.stringify({ error: "ElevenLabs error" }), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const data = await resp.json();
        return new Response(JSON.stringify({ voices: (data.voices || []).map((v: any) => ({ voice_id: v.voice_id, name: v.name, category: v.category || "elevenlabs", provider: "elevenlabs" })) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ voices: GEMINI_VOICES.map(v => ({ voice_id: v.id, name: `${v.name} (${v.gender}, ${v.style})`, category: `${v.gender} - ${v.style}`, provider: "gemini" })) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!text || !voiceId) return new Response(JSON.stringify({ error: "text and voiceId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ElevenLabs (BYOK)
    if (provider === "elevenlabs" && elevenLabsKey) {
      console.log(`[VOICE] ElevenLabs for user ${userData.id}`);
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
        body: JSON.stringify({ text: text.substring(0, 5000), model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      });
      if (!resp.ok) { const e = await resp.text(); return new Response(JSON.stringify({ error: "ElevenLabs failed: " + e.substring(0, 200) }), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
      const buf = await resp.arrayBuffer();
      // Safe base64 encoding for large audio buffers (avoid call stack overflow with spread operator)
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
      }
      return new Response(JSON.stringify({ audio: btoa(binary), mimeType: "audio/mpeg", provider: "elevenlabs" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Gemini TTS (free)
    const gKey = googleApiKey || Deno.env.get("GOOGLE_API_KEY") || "";
    if (!gKey) return new Response(JSON.stringify({ error: "No API key available" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    console.log(`[VOICE] Gemini TTS for user ${userData.id}, voice ${voiceId}`);
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${gKey}`;
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Read the following narration naturally: ${text.substring(0, 5000)}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } },
        },
      }),
    });

    if (!resp.ok) { const e = await resp.text(); console.error("[VOICE] Gemini error:", e.substring(0, 300)); let msg = "Voice generation failed"; try { msg = JSON.parse(e).error?.message || msg; } catch {} return new Response(JSON.stringify({ error: msg }), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    const data = await resp.json();
    const audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!audio?.data) return new Response(JSON.stringify({ error: "No audio generated" }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ audio: audio.data, mimeType: audio.mimeType || "audio/L16;rate=24000", provider: "gemini" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[VOICE] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
