import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET: list favorites, optionally filtered by asset_type
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const assetType = request.nextUrl.searchParams.get("type");

  let query = supabase
    .from("studio_asset_favorites")
    .select("*")
    .order("usage_count", { ascending: false });

  if (assetType) {
    query = query.eq("asset_type", assetType);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorites: data || [] });
}

// POST: add or toggle a favorite
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { asset_type, provider, external_id, name, metadata, preview_url } = body;

  if (!asset_type || !name) {
    return NextResponse.json({ error: "asset_type and name are required" }, { status: 400 });
  }

  const supabase = createServerSupabase();

  // Check if already exists
  let existingQuery = supabase
    .from("studio_asset_favorites")
    .select("id")
    .eq("asset_type", asset_type);

  if (external_id) {
    existingQuery = existingQuery.eq("external_id", external_id).eq("provider", provider || "epidemic_sound");
  } else {
    existingQuery = existingQuery.eq("name", name);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    // Remove (toggle off)
    const { error } = await supabase
      .from("studio_asset_favorites")
      .delete()
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ action: "removed", id: existing.id });
  }

  // Add new favorite
  const { data, error } = await supabase
    .from("studio_asset_favorites")
    .insert({
      asset_type,
      provider: provider || "epidemic_sound",
      external_id: external_id || null,
      name,
      metadata: metadata || {},
      preview_url: preview_url || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ action: "added", favorite: data });
}

// DELETE: remove a favorite by ID
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("studio_asset_favorites")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ action: "removed", id });
}
