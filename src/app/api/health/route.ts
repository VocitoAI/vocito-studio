import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const checks = {
    database: false,
    anthropic: false,
    fish_audio: false,
    epidemic_sound: false,
    worker: false,
  };

  // 1. Supabase check
  try {
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("studio_prompts")
      .select("id")
      .limit(1);
    checks.database = !error;
  } catch {
    checks.database = false;
  }

  // 2. Anthropic check (key format)
  checks.anthropic = !!process.env.ANTHROPIC_API_KEY?.startsWith("sk-ant-");

  // 3. Fish Audio check
  checks.fish_audio = !!process.env.FISH_AUDIO_API_KEY;

  // 4. Epidemic Sound check
  checks.epidemic_sound = !!process.env.EPIDEMIC_SOUND_API_KEY;

  // 5. Worker health
  const workerUrl = process.env.WORKER_URL;
  if (workerUrl) {
    try {
      const res = await fetch(`${workerUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      checks.worker = res.ok;
    } catch {
      checks.worker = false;
    }
  }

  const allHealthy = Object.values(checks).every((v) => v === true);

  return NextResponse.json({
    status: allHealthy ? "healthy" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  });
}
