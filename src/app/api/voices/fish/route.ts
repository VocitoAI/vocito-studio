import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY || "";

export async function GET(request: NextRequest) {
  if (!FISH_API_KEY) {
    return NextResponse.json({ error: "Fish Audio API key not configured" }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const page_size = params.get("page_size") || "40";
  const page_number = params.get("page_number") || "1";
  const sort_by = params.get("sort_by") || "task_count";
  const language = params.get("language") || "";
  const tag = params.get("tag") || "";
  const title = params.get("title") || "";
  const author = params.get("author") || "";

  try {
    const qs = new URLSearchParams({
      page_size,
      page_number,
      sort_by,
    });
    if (language) qs.set("language", language);
    if (tag) qs.set("tag", tag);
    if (title) qs.set("title", title);
    if (author) qs.set("author_id", author);

    const res = await fetch(`https://api.fish.audio/model?${qs}`, {
      headers: { Authorization: `Bearer ${FISH_API_KEY}` },
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
      cover_url: v.cover_image ? `https://fish.audio/api/cover/${v.cover_image}` : null,
      image_url: v.author?.avatar ? `https://fish.audio/api/cover/avatars/${v.author.avatar}` : null,
      languages: v.languages || [],
      tags: v.tags || [],
      task_count: v.task_count || 0,
      like_count: v.like_count || 0,
      author_name: v.author?.nickname || null,
      created_at: v.created_at,
      provider: "fish_audio" as const,
    }));

    return NextResponse.json({
      voices,
      total: data.total || 0,
      has_more: data.has_more ?? voices.length >= Number(page_size),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
