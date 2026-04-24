import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  SCENE_PLAN_SYSTEM_PROMPT,
  buildUserMessage,
} from "@/lib/ai/systemPrompt";
import { ScenePlanSchema } from "@/types/scenePlan";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rawJsonSchema = z.toJSONSchema(ScenePlanSchema) as any;
const { $schema: _, ...scenePlanJsonSchema } = rawJsonSchema;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createServerSupabase();

    // Fetch previous rejected plan
    const { data: previousPrompt, error: fetchError } = await supabase
      .from("studio_prompts")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !previousPrompt) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (previousPrompt.status !== "plan_rejected") {
      return NextResponse.json(
        { error: "Only rejected plans can be regenerated" },
        { status: 400 }
      );
    }

    if (!previousPrompt.review_feedback) {
      return NextResponse.json(
        { error: "No feedback provided for regeneration" },
        { status: 400 }
      );
    }

    // Create new prompt record
    const { data: newPrompt, error: insertError } = await supabase
      .from("studio_prompts")
      .insert({
        raw_prompt: previousPrompt.raw_prompt,
        language: previousPrompt.language,
        status: "plan_pending",
        notes: `Regenerated from rejected plan ${id} with feedback`,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Call Claude with feedback context
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      system: SCENE_PLAN_SYSTEM_PROMPT,
      tools: [
        {
          name: "generate_scene_plan",
          description:
            "Generate a complete ScenePlan for a Vocito launch video. Every field in the schema is REQUIRED unless marked optional. Enums must be used EXACTLY as specified.",
          input_schema: scenePlanJsonSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "generate_scene_plan" },
      messages: [
        {
          role: "user",
          content: buildUserMessage({
            rawPrompt: previousPrompt.raw_prompt,
            language: previousPrompt.language,
            previousRejection: {
              feedback: previousPrompt.review_feedback,
            },
          }),
        },
      ],
    });

    const toolUseBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("Claude did not use the tool");
    }

    const parsed = ScenePlanSchema.safeParse(toolUseBlock.input);

    if (!parsed.success) {
      const issuesJson = JSON.stringify(parsed.error.issues, null, 2);
      console.error("[/api/plan/regenerate] Zod validation failed:", issuesJson);

      await supabase
        .from("studio_prompts")
        .update({
          status: "plan_rejected",
          notes: `Validation failed:\n${issuesJson.slice(0, 4000)}`,
        })
        .eq("id", newPrompt.id);

      return NextResponse.json(
        {
          error: "ScenePlan validation failed",
          issues: parsed.error.issues,
          promptId: newPrompt.id,
        },
        { status: 500 }
      );
    }

    await supabase
      .from("studio_prompts")
      .update({
        scene_plan: parsed.data,
        status: "plan_ready",
      })
      .eq("id", newPrompt.id);

    return NextResponse.json({
      promptId: newPrompt.id,
      scenePlan: parsed.data,
    });
  } catch (error) {
    console.error("[/api/plan/regenerate] Error:", error);
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
