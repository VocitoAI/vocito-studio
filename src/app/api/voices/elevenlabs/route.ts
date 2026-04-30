import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EL_API_KEY = process.env.ELEVENLABS_API_KEY || "";

export async function GET() {
  if (!EL_API_KEY) {
    return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
  }

  try {
    // Fetch shared voices from ElevenLabs library
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": EL_API_KEY },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `ElevenLabs API error: ${text}` }, { status: res.status });
    }

    const data = await res.json();
    const voices = (data.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name || "Untitled",
      description: v.labels?.description || v.description || "",
      preview_url: v.preview_url || null,
      cover_url: null,
      category: v.category || "unknown",
      gender: v.labels?.gender || null,
      accent: v.labels?.accent || null,
      age: v.labels?.age || null,
      language: v.labels?.language || null,
      use_case: v.labels?.use_case || null,
      tags: Object.values(v.labels || {}).filter(Boolean),
      provider: "elevenlabs",
    }));

    return NextResponse.json({ voices });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
