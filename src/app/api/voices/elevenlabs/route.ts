import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EL_API_KEY = process.env.ELEVENLABS_API_KEY || "";

// Two modes: "my" = user's own voices, "library" = shared public library
export async function GET(request: NextRequest) {
  if (!EL_API_KEY) {
    return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const mode = params.get("mode") || "library";

  try {
    if (mode === "my") {
      // User's own voices
      const res = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": EL_API_KEY },
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ error: text }, { status: res.status });
      }
      const data = await res.json();
      const voices = (data.voices || []).map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name || "Untitled",
        description: v.labels?.descriptive || v.description || "",
        preview_url: v.preview_url || null,
        image_url: null,
        category: v.category || "unknown",
        gender: v.labels?.gender || null,
        accent: v.labels?.accent || null,
        age: v.labels?.age || null,
        language: v.labels?.language || null,
        use_case: v.labels?.use_case || null,
        provider: "elevenlabs" as const,
        is_own: true,
      }));
      return NextResponse.json({ voices, total: voices.length, has_more: false });
    }

    // Shared library with full filters
    const page_size = params.get("page_size") || "40";
    const gender = params.get("gender") || "";
    const language = params.get("language") || "";
    const age = params.get("age") || "";
    const accent = params.get("accent") || "";
    const use_case = params.get("use_case") || "";
    const category = params.get("category") || "";
    const search = params.get("search") || "";
    const sort = params.get("sort") || "usage_character_count_1y";
    const featured = params.get("featured") || "";
    const page = params.get("page") || "";

    const qs = new URLSearchParams({ page_size, sort });
    if (gender) qs.set("gender", gender);
    if (language) qs.set("language", language);
    if (age) qs.set("age", age);
    if (accent) qs.set("accent", accent);
    if (use_case) qs.set("use_case", use_case);
    if (category) qs.set("category", category);
    if (search) qs.set("search", search);
    if (featured) qs.set("featured", "true");
    if (page) qs.set("page", page);

    const res = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${qs}`, {
      headers: { "xi-api-key": EL_API_KEY },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    const voices = (data.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      public_owner_id: v.public_owner_id,
      name: v.name || "Untitled",
      description: v.description || "",
      preview_url: v.preview_url || null,
      image_url: v.image_url || null,
      category: v.category || "unknown",
      gender: v.gender || null,
      accent: v.accent || null,
      age: v.age || null,
      language: v.language || null,
      use_case: v.use_case || null,
      usage_count_1y: v.usage_character_count_1y || 0,
      cloned_by_count: v.cloned_by_count || 0,
      featured: v.featured || false,
      free_users_allowed: v.free_users_allowed ?? true,
      provider: "elevenlabs" as const,
      is_own: false,
    }));

    return NextResponse.json({
      voices,
      total: data.total_count || 0,
      has_more: data.has_more ?? false,
      last_sort_id: data.last_sort_id || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
