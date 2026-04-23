import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("studio_video_runs")
    .select(
      "id, created_at, status, duration_seconds, output_url, prompt_id, scene_plan"
    )
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ videos: data });
}
