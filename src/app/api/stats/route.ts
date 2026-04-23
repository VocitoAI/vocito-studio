import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();

  const [totalRes, monthRes, approvedRes] = await Promise.all([
    supabase
      .from("studio_video_runs")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("studio_video_runs")
      .select("*", { count: "exact", head: true })
      .gte(
        "created_at",
        new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        ).toISOString()
      ),
    supabase
      .from("studio_video_runs")
      .select("*", { count: "exact", head: true })
      .eq("review_decision", "approved"),
  ]);

  return NextResponse.json({
    total: totalRes.count ?? 0,
    thisMonth: monthRes.count ?? 0,
    approved: approvedRes.count ?? 0,
  });
}
