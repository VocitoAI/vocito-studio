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

// Convert Zod v4 schema to JSON Schema, then clean for Anthropic compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rawJsonSchema = z.toJSONSchema(ScenePlanSchema) as any;
const { $schema: _, ...rawClean } = rawJsonSchema;

// Anthropic tool use doesn't support "const" or "additionalProperties"
// Convert const → enum[value], strip additionalProperties
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanSchemaForAnthropic(obj: any): any {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(cleanSchemaForAnthropic);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "additionalProperties") continue;
    if (k === "const") {
      result["enum"] = [v];
      continue;
    }
    result[k] = cleanSchemaForAnthropic(v);
  }
  return result;
}

const scenePlanJsonSchema = cleanSchemaForAnthropic(rawClean);

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  let promptId: string | null = null;

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

    promptId = promptRecord.id;

    // Call Claude API with tool use for structured output
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      system: SCENE_PLAN_SYSTEM_PROMPT,
      tools: [
        {
          name: "generate_scene_plan",
          description:
            "Generate a complete ScenePlan for a Vocito launch video. Every field in the schema is REQUIRED unless marked optional. Enums must be used EXACTLY as specified. uiElements must be objects with type/content/animationIn/showFromFrame/showUntilFrame.",
          input_schema: scenePlanJsonSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "generate_scene_plan" },
      messages: [
        {
          role: "user",
          content: buildUserMessage({ rawPrompt, language }),
        },
      ],
    });

    // Extract tool use result
    const toolUseBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      const rawContent = JSON.stringify(response.content).slice(0, 500);
      console.error(
        "[/api/plan] Claude did not use tool. Response:",
        rawContent
      );

      await supabase
        .from("studio_prompts")
        .update({
          status: "plan_rejected",
          notes: `Claude did not use generate_scene_plan tool. Response: ${rawContent}`,
        })
        .eq("id", promptId);

      return NextResponse.json(
        {
          error: "Claude did not use the generate_scene_plan tool",
          promptId,
        },
        { status: 500 }
      );
    }

    console.log("[/api/plan] Stop reason:", response.stop_reason);
    console.log("[/api/plan] Usage:", JSON.stringify(response.usage));
    console.log("[/api/plan] Tool use block name:", toolUseBlock.name);
    console.log("[/api/plan] Tool input keys:", Object.keys(toolUseBlock.input || {}));
    console.log("[/api/plan] Full input (first 1000 chars):", JSON.stringify(toolUseBlock.input).slice(0, 1000));

    let scenePlanJson = toolUseBlock.input as Record<string, unknown>;

    // Claude sometimes wraps output in a single key — unwrap it
    if (!scenePlanJson.meta) {
      const keys = Object.keys(scenePlanJson);
      if (keys.length === 1) {
        const inner = scenePlanJson[keys[0]];
        if (inner && typeof inner === "object" && !Array.isArray(inner)) {
          scenePlanJson = inner as Record<string, unknown>;
          console.log("[/api/plan] Unwrapped from key:", keys[0]);
        }
      }
    }

    // Validate with Zod (belt-and-suspenders — tool use should match schema)
    const parsed = ScenePlanSchema.safeParse(scenePlanJson);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const issuesJson = JSON.stringify(issues, null, 2);

      console.error("[/api/plan] Zod validation failed despite tool use:");
      console.error(issuesJson);

      const inputPreview = JSON.stringify(scenePlanJson).slice(0, 2000);
      const notesContent = `Tool use validation failed.\n\nStop reason: ${response.stop_reason}\nUsage: ${JSON.stringify(response.usage)}\nTool name: ${toolUseBlock.name}\nInput keys: ${Object.keys(toolUseBlock.input || {}).join(", ")}\n\nInput preview:\n${inputPreview}\n\nIssues:\n${issuesJson.slice(0, 2000)}`;

      await supabase
        .from("studio_prompts")
        .update({
          status: "plan_rejected",
          notes: notesContent,
        })
        .eq("id", promptId);

      return NextResponse.json(
        {
          error: "ScenePlan validation failed",
          promptId,
          issues,
        },
        { status: 500 }
      );
    }

    // Save valid plan
    const { error: updateError } = await supabase
      .from("studio_prompts")
      .update({
        scene_plan: parsed.data,
        status: "plan_ready",
      })
      .eq("id", promptId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save plan: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      promptId,
      scenePlan: parsed.data,
    });
  } catch (error) {
    console.error("[/api/plan] Unhandled error:", error);

    if (promptId) {
      try {
        await supabase
          .from("studio_prompts")
          .update({
            status: "plan_rejected",
            notes: `Unhandled error: ${error instanceof Error ? error.message : "Unknown"}\n\nStack: ${error instanceof Error ? error.stack?.slice(0, 1000) : "N/A"}`,
          })
          .eq("id", promptId);
      } catch {
        // Don't let secondary save fail the response
      }
    }

    return NextResponse.json(
      {
        error:
          "Server error: " +
          (error instanceof Error ? error.message : "Unknown"),
        promptId,
      },
      { status: 500 }
    );
  }
}
