import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EL_API_KEY = process.env.ELEVENLABS_API_KEY || "";

// POST: Generate 3 voice previews from a text description
export async function POST(request: NextRequest) {
  if (!EL_API_KEY) {
    return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
  }

  const { action, voice_description, preview_text, generated_voice_id, voice_name, voice_description_label } = await request.json();

  if (action === "preview") {
    if (!voice_description || voice_description.length < 20) {
      return NextResponse.json({ error: "Voice description must be at least 20 characters" }, { status: 400 });
    }

    try {
      const res = await fetch("https://api.elevenlabs.io/v1/text-to-voice/create-previews", {
        method: "POST",
        headers: {
          "xi-api-key": EL_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voice_description,
          text: preview_text || "Hi there! I'm a custom voice created just for you. How does this sound?",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `Voice design error: ${errText}` }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json({ previews: data.previews || [] });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  if (action === "create") {
    if (!generated_voice_id || !voice_name) {
      return NextResponse.json({ error: "generated_voice_id and voice_name are required" }, { status: 400 });
    }

    try {
      const res = await fetch("https://api.elevenlabs.io/v1/text-to-voice/create-voice-from-preview", {
        method: "POST",
        headers: {
          "xi-api-key": EL_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voice_name,
          voice_description: voice_description_label || "",
          generated_voice_id,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `Voice create error: ${errText}` }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json({ voice_id: data.voice_id });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "action must be 'preview' or 'create'" }, { status: 400 });
}
