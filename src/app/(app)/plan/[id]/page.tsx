import { createServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PlanReviewContent } from "@/components/app/plan-review-content";

export const dynamic = "force-dynamic";

async function getPlan(id: string) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("studio_prompts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export default async function PlanReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await getPlan(id);

  if (!plan) notFound();

  return <PlanReviewContent plan={plan} />;
}
