import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const body = await request.json();
  const { decision, feedback } = body;

  if (!["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const supabase = createServerSupabase();

  if (decision === "approved") {
    await supabase
      .from("studio_video_runs")
      .update({
        review_decision: "approved",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    return NextResponse.json({ message: "Approved", runId });
  }

  // Rejection
  if (!feedback?.categories?.length) {
    return NextResponse.json(
      { error: "Categories required" },
      { status: 400 }
    );
  }

  const structured = {
    categories: feedback.categories,
    global_feedback: feedback.globalFeedback || "",
    per_scene_feedback: feedback.perScene || {},
    submitted_at: new Date().toISOString(),
  };

  await supabase
    .from("studio_video_runs")
    .update({
      review_decision: "rejected",
      review_feedback: feedback.globalFeedback || "",
      review_feedback_structured: structured,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  // Trigger worker iteration
  const workerUrl = process.env.WORKER_URL!;
  fetch(`${workerUrl}/jobs/iterate/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentRunId: runId }),
  }).catch((err) => console.error("Iteration webhook failed:", err));

  return NextResponse.json({ message: "Iteration triggered", runId });
}
