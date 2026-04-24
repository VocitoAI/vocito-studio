import { createServerSupabase } from "@/lib/supabase/server";
import { LibraryContent } from "@/components/app/library-content";

export const dynamic = "force-dynamic";

async function getPrompts() {
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("studio_prompts")
      .select(
        "id, raw_prompt, language, status, created_at, review_feedback, notes"
      )
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function LibraryPage() {
  const prompts = await getPrompts();
  return <LibraryContent prompts={prompts} />;
}
