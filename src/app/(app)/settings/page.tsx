import { SettingsContent } from "@/components/app/settings-content";

async function getHealthChecks() {
  const defaultChecks = {
    database: false,
    anthropic: false,
    fish_audio: false,
    epidemic_sound: false,
    worker: false,
  };

  try {
    // Call health endpoint internally
    const { createServerSupabase } = await import("@/lib/supabase/server");

    // Database check
    try {
      const supabase = createServerSupabase();
      const { error } = await supabase
        .from("studio_prompts")
        .select("id")
        .limit(1);
      defaultChecks.database = !error;
    } catch {
      defaultChecks.database = false;
    }

    // Key format checks
    defaultChecks.anthropic =
      !!process.env.ANTHROPIC_API_KEY?.startsWith("sk-ant-");
    defaultChecks.fish_audio = !!process.env.FISH_AUDIO_API_KEY;
    defaultChecks.epidemic_sound = !!process.env.EPIDEMIC_SOUND_API_KEY;

    // Worker check
    const workerUrl = process.env.WORKER_URL;
    if (workerUrl) {
      try {
        const res = await fetch(`${workerUrl}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        defaultChecks.worker = res.ok;
      } catch {
        defaultChecks.worker = false;
      }
    }
  } catch {
    // Return defaults
  }

  return defaultChecks;
}

export default async function SettingsPage() {
  const checks = await getHealthChecks();
  return <SettingsContent checks={checks} />;
}
