import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from("studio_video_runs")
      .select("id, status, error_message, output_url, current_step, progress_percent, created_at")
      .eq("prompt_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      // Table might not exist yet — return null run instead of 500
      return NextResponse.json({ run: null });
    }

    const rawRun = data?.[0] || null;
    if (!rawRun) {
      return NextResponse.json({ run: null });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run: any = { ...rawRun, signed_url: null };

    if (run.output_url && run.status === "completed") {
      try {
        const signed = await supabase.storage
          .from("studio-videos")
          .createSignedUrl(run.output_url, 3600);
        run.signed_url = signed.data?.signedUrl || null;
      } catch {
        // Storage bucket might not exist yet
      }
    }

    return NextResponse.json({ run });
  } catch {
    // Catch-all: return null run
    return NextResponse.json({ run: null });
  }
}
