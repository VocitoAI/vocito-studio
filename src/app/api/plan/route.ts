import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  SCENE_PLAN_SYSTEM_PROMPT,
  buildUserMessage,
} from "@/lib/ai/systemPrompt";
import { ScenePlanSchema } from "@/types/scenePlan";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { rawPrompt, language } = await request.json();

    if (!rawPrompt || typeof rawPrompt !== "string" || rawPrompt.length < 10) {
      return NextResponse.json(
        { error: "Prompt must be at least 10 characters" },
        { status: 400 }
      );
    }

    if (!["en", "nl", "de"].includes(language)) {
      return NextResponse.json(
        { error: "Language must be en, nl, or de" },
        { status: 400 }
      );
    }

    // Create prompt record
    const supabase = createServerSupabase();
    const { data: promptRecord, error: insertError } = await supabase
      .from("studio_prompts")
      .insert({
        raw_prompt: rawPrompt,
        language,
        status: "plan_pending",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Database error: " + insertError.message },
        { status: 500 }
      );
    }

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: SCENE_PLAN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserMessage({ rawPrompt, language }),
        },
      ],
    });

    // Extract JSON
    const textContent = response.content.find((b) => b.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    let scenePlanJson;
    try {
      scenePlanJson = JSON.parse(textContent.text);
    } catch {
      // Strip markdown fences if Claude added them
      const cleaned = textContent.text
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      scenePlanJson = JSON.parse(cleaned);
    }

    // Validate against schema
    const parsed = ScenePlanSchema.safeParse(scenePlanJson);
    if (!parsed.success) {
      await supabase
        .from("studio_prompts")
        .update({
          status: "plan_rejected",
          notes:
            "Schema validation failed: " +
            JSON.stringify(parsed.error.issues).slice(0, 500),
        })
        .eq("id", promptRecord.id);

      return NextResponse.json(
        {
          error: "Claude generated invalid ScenePlan",
          issues: parsed.error.issues,
          promptId: promptRecord.id,
        },
        { status: 500 }
      );
    }

    // Save plan
    const { error: updateError } = await supabase
      .from("studio_prompts")
      .update({
        scene_plan: parsed.data,
        status: "plan_ready",
      })
      .eq("id", promptRecord.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save plan: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      promptId: promptRecord.id,
      scenePlan: parsed.data,
    });
  } catch (error) {
    console.error("[/api/plan] Error:", error);
    return NextResponse.json(
      {
        error:
          "Server error: " +
          (error instanceof Error ? error.message : "Unknown"),
      },
      { status: 500 }
    );
  }
}
