import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EL_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY || "";

export async function POST(request: NextRequest) {
  const { text, voice_id, provider } = await request.json();

  if (!text || !voice_id || !provider) {
    return NextResponse.json({ error: "text, voice_id, and provider are required" }, { status: 400 });
  }

  if (text.length > 500) {
    return NextResponse.json({ error: "Text max 500 characters" }, { status: 400 });
  }

  try {
    let audioBytes: ArrayBuffer;

    if (provider === "elevenlabs") {
      if (!EL_API_KEY) return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });

      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: "POST",
        headers: {
          "xi-api-key": EL_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.4,
            use_speaker_boost: true,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `ElevenLabs TTS error: ${errText}` }, { status: res.status });
      }

      audioBytes = await res.arrayBuffer();
    } else if (provider === "fish_audio") {
      if (!FISH_API_KEY) return NextResponse.json({ error: "Fish Audio API key not configured" }, { status: 500 });

      const res = await fetch("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FISH_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          reference_id: voice_id,
          format: "mp3",
          mp3_bitrate: 128,
          normalize: true,
          latency: "balanced",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `Fish Audio TTS error: ${errText}` }, { status: res.status });
      }

      audioBytes = await res.arrayBuffer();
    } else {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    // Return audio as base64
    const base64 = Buffer.from(audioBytes).toString("base64");
    return NextResponse.json({
      audio_base64: base64,
      content_type: "audio/mpeg",
      size_bytes: audioBytes.byteLength,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
