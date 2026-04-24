import { createServerSupabase } from "@/lib/supabase/server";
import { LibraryContent } from "@/components/app/library-content";

async function getPrompts() {
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("studio_prompts")
      .select("id, raw_prompt, language, status, created_at, scene_plan")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function LibraryPage() {
  const prompts = await getPrompts();
  return <LibraryContent prompts={prompts} />;
}
