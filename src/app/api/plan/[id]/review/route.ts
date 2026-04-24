import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { decision, feedback } = await request.json();

  if (!["approve", "reject"].includes(decision)) {
    return NextResponse.json(
      { error: "Decision must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabase();

  const newStatus =
    decision === "approve" ? "plan_approved" : "plan_rejected";

  const { error } = await supabase
    .from("studio_prompts")
    .update({
      status: newStatus,
      review_feedback: feedback || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Trigger asset resolution on approve (fire-and-forget)
  if (decision === "approve") {
    const workerUrl =
      process.env.WORKER_URL ||
      "https://worker-production-0296.up.railway.app";
    fetch(`${workerUrl}/webhooks/plan-approved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_id: id }),
    }).catch((err) => {
      console.error("[review] Worker webhook failed:", err);
    });
  }

  return NextResponse.json({ success: true, status: newStatus });
}
