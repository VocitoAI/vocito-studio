import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET: list all favorites
export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("studio_voice_favorites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorites: data || [] });
}

// POST: toggle favorite (add or remove)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { provider, voice_id, name, preview_url, language, gender, accent, tags } = body;

  if (!provider || !voice_id || !name) {
    return NextResponse.json({ error: "provider, voice_id, and name are required" }, { status: 400 });
  }

  const supabase = createServerSupabase();

  // Check if already favorited
  const { data: existing } = await supabase
    .from("studio_voice_favorites")
    .select("id")
    .eq("provider", provider)
    .eq("voice_id", voice_id)
    .maybeSingle();

  if (existing) {
    // Remove favorite
    const { error } = await supabase
      .from("studio_voice_favorites")
      .delete()
      .eq("id", existing.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ action: "removed", voice_id });
  } else {
    // Add favorite
    const { error } = await supabase
      .from("studio_voice_favorites")
      .insert({ provider, voice_id, name, preview_url, language, gender, accent, tags });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ action: "added", voice_id });
  }
}
