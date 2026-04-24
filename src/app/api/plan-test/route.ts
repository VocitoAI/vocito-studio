import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const start = Date.now();
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: 'Say hello in JSON: {"greeting": "..."}',
        },
      ],
    });
    const elapsed = Date.now() - start;
    return NextResponse.json({
      success: true,
      elapsed_ms: elapsed,
      content: response.content,
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      elapsed_ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
