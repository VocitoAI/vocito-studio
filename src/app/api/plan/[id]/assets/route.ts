import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("studio_prompt_assets")
    .select(
      `
      id,
      usage_context,
      scene_id,
      frame_offset,
      volume,
      asset:studio_assets (
        id,
        asset_type,
        title,
        duration_ms,
        bpm,
        mood,
        supabase_storage_path,
        download_status
      )
    `
    )
    .eq("prompt_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assets: data });
}
