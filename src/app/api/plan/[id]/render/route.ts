import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabase();

  const { data: plan } = await supabase
    .from("studio_prompts")
    .select("status, assets_status")
    .eq("id", id)
    .single();

  if (!plan)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (plan.status !== "plan_approved")
    return NextResponse.json(
      { error: "Plan must be approved" },
      { status: 400 }
    );
  if (plan.assets_status !== "ready")
    return NextResponse.json(
      { error: "Assets not ready" },
      { status: 400 }
    );

  // Trigger worker
  const workerUrl =
    process.env.WORKER_URL ||
    "https://worker-production-0296.up.railway.app";

  fetch(`${workerUrl}/jobs/render/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ promptId: id }),
  }).catch((err) => {
    console.error("[render] Worker trigger failed:", err);
  });

  return NextResponse.json({ message: "Render triggered", promptId: id });
}
