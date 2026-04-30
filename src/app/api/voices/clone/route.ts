import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EL_API_KEY = process.env.ELEVENLABS_API_KEY || "";

// POST: Instant voice clone from audio file
export async function POST(request: NextRequest) {
  if (!EL_API_KEY) {
    return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const files = formData.getAll("files") as File[];

    if (!name || files.length === 0) {
      return NextResponse.json({ error: "name and at least one audio file are required" }, { status: 400 });
    }

    // Forward to ElevenLabs
    const elForm = new FormData();
    elForm.append("name", name);
    if (description) elForm.append("description", description);
    for (const file of files) {
      elForm.append("files", file);
    }

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": EL_API_KEY },
      body: elForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Clone error: ${errText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ voice_id: data.voice_id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
