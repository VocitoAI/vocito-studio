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

  return NextResponse.json({ success: true, status: newStatus });
}
