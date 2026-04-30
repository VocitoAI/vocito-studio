import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY || "";

export async function GET() {
  if (!FISH_API_KEY) {
    return NextResponse.json({ error: "Fish Audio API key not configured" }, { status: 500 });
  }

  try {
    // Fetch public models from Fish Audio
    const res = await fetch("https://api.fish.audio/model?page_size=100&sort_by=task_count", {
      headers: { Authorization: `Bearer ${FISH_API_KEY}` },
      next: { revalidate: 3600 }, // cache 1 hour
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Fish Audio API error: ${text}` }, { status: res.status });
    }

    const data = await res.json();
    const voices = (data.items || []).map((v: any) => ({
      voice_id: v._id,
      name: v.title || "Untitled",
      description: v.description || "",
      preview_url: v.samples?.[0]?.audio || v.samples?.[0]?.url || null,
      cover_url: v.cover_image || null,
      languages: v.languages || [],
      tags: v.tags || [],
      task_count: v.task_count || 0,
      provider: "fish_audio",
    }));

    return NextResponse.json({ voices });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
