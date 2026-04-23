import { createServerSupabase } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/app/dashboard-content";

async function getStats() {
  try {
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
    return {
      total: totalRes.count ?? 0,
      thisMonth: monthRes.count ?? 0,
      approved: approvedRes.count ?? 0,
    };
  } catch {
    return { total: 0, thisMonth: 0, approved: 0 };
  }
}

async function getRecentVideos() {
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("studio_video_runs")
      .select(
        "id, created_at, status, duration_seconds, output_url, prompt_id, scene_plan"
      )
      .order("created_at", { ascending: false })
      .limit(5);
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const [stats, recentVideos] = await Promise.all([
    getStats(),
    getRecentVideos(),
  ]);

  return <DashboardContent stats={stats} recentVideos={recentVideos} />;
}
