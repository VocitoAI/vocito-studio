import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabase();

  const { data: runs } = await supabase
    .from("studio_video_runs")
    .select("*")
    .eq("prompt_id", id)
    .order("iteration_number", { ascending: false });

  if (!runs) return NextResponse.json({ iterations: [] });

  for (const run of runs) {
    if (run.output_url && run.status === "completed") {
      try {
        const { data: signed } = await supabase.storage
          .from("studio-videos")
          .createSignedUrl(run.output_url, 7200);
        run.signed_url = signed?.signedUrl || null;
      } catch {
        run.signed_url = null;
      }
    }
  }

  return NextResponse.json({ iterations: runs });
}
