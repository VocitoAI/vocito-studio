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
    .from("studio_video_runs")
    .select("id, status, error_message, storage_path, created_at, notes")
    .eq("prompt_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawRun = data?.[0] || null;
  if (!rawRun) {
    return NextResponse.json({ run: null });
  }

  // Build response with optional signed URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run: any = { ...rawRun, signed_url: null };

  if (run.storage_path && run.status === "completed") {
    const signed = await supabase.storage
      .from("studio-videos")
      .createSignedUrl(run.storage_path, 3600);
    run.signed_url = signed.data?.signedUrl || null;
  }

  return NextResponse.json({ run });
}
