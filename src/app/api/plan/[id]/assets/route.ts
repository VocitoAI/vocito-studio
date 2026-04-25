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
        supabase_storage_path,
        storage_bucket,
        download_status
      )
    `
    )
    .eq("prompt_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Generate signed URLs for audio preview
  const assets = await Promise.all(
    (data || []).map(async (link) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const asset = link.asset as any;
      let signed_url: string | null = null;

      if (asset?.supabase_storage_path) {
        const bucket = asset.storage_bucket || "studio-assets";
        const result = await supabase.storage
          .from(bucket)
          .createSignedUrl(asset.supabase_storage_path, 3600);
        signed_url = result.data?.signedUrl || null;
      }

      return { ...link, signed_url };
    })
  );

  return NextResponse.json({ assets });
}
