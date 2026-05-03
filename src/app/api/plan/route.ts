import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  SCENE_PLAN_SYSTEM_PROMPT,
  buildUserMessage,
  buildTemplateSystemPrompt,
} from "@/lib/ai/systemPrompt";
import { ScenePlanSchema, LaunchV1ScenePlanSchema } from "@/types/scenePlan";
import { TEMPLATES } from "@/lib/templates/registry";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Anthropic tool use doesn't support "const" or "additionalProperties"
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

// Pre-compute launch_v1 schema (most common)
const launchV1JsonSchema = cleanSchemaForAnthropic(
  (() => { const { $schema: _, ...rest } = z.toJSONSchema(LaunchV1ScenePlanSchema) as any; return rest; })()
);

// Generic schema for non-launch templates
const genericJsonSchema = cleanSchemaForAnthropic(
  (() => { const { $schema: _, ...rest } = z.toJSONSchema(ScenePlanSchema) as any; return rest; })()
);

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  let promptId: string | null = null;

  try {
    const body = await request.json();
    const { rawPrompt, language, template: templateId = "launch_v1", extraFields = {} } = body;

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

    if (!TEMPLATES[templateId]) {
      // Unknown templates fall back to universal instead of erroring
      console.log(`[/api/plan] Unknown template "${templateId}", falling back to universal`);
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

    // Select schema and system prompt based on template
    const isLaunch = templateId === "launch_v1";
    const isUniversal = templateId === "universal" || !TEMPLATES[templateId];
    const effectiveTemplateId = TEMPLATES[templateId] ? templateId : "universal";
    const toolSchema = isLaunch ? launchV1JsonSchema : genericJsonSchema;
    const systemPrompt = isLaunch
      ? SCENE_PLAN_SYSTEM_PROMPT
      : buildTemplateSystemPrompt(effectiveTemplateId);

    // Call Claude API with tool use for structured output
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      system: systemPrompt,
      tools: [
        {
          name: "generate_scene_plan",
          description:
            `Generate a complete ScenePlan for a Vocito ${TEMPLATES[effectiveTemplateId]?.name || "video"}. Every field in the schema is REQUIRED unless marked optional. Enums must be used EXACTLY as specified.`,
          input_schema: toolSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "generate_scene_plan" },
      messages: [
        {
          role: "user",
          content: buildUserMessage({ rawPrompt, language, template: effectiveTemplateId, extraFields }),
        },
      ],
    });

    // Extract tool use result
    const toolUseBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      const rawContent = JSON.stringify(response.content).slice(0, 500);
      console.error("[/api/plan] Claude did not use tool. Response:", rawContent);

      await supabase
        .from("studio_prompts")
        .update({
          status: "plan_rejected",
          notes: `Claude did not use generate_scene_plan tool. Response: ${rawContent}`,
        })
        .eq("id", promptId);

      return NextResponse.json(
        { error: "Claude did not use the generate_scene_plan tool", promptId },
        { status: 500 }
      );
    }

    console.log("[/api/plan] Stop reason:", response.stop_reason);
    console.log("[/api/plan] Usage:", JSON.stringify(response.usage));

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

    // Validate with Zod — universal uses generic schema for maximum flexibility
    const schema = isLaunch ? LaunchV1ScenePlanSchema : ScenePlanSchema;
    const parsed = schema.safeParse(scenePlanJson);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      console.error("[/api/plan] Zod validation failed:", JSON.stringify(issues, null, 2));

      await supabase
        .from("studio_prompts")
        .update({
          status: "plan_rejected",
          notes: `Validation failed.\n${JSON.stringify(issues).slice(0, 2000)}`,
        })
        .eq("id", promptId);

      return NextResponse.json(
        { error: "ScenePlan validation failed", promptId, issues },
        { status: 500 }
      );
    }

    // Ensure template field is set in meta
    const planData = parsed.data as any;
    if (!planData.meta.template) {
      planData.meta.template = effectiveTemplateId;
    }

    // Save valid plan
    const { error: updateError } = await supabase
      .from("studio_prompts")
      .update({
        scene_plan: planData,
        status: "plan_ready",
      })
      .eq("id", promptId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save plan: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ promptId, scenePlan: planData });
  } catch (error) {
    console.error("[/api/plan] Unhandled error:", error);

    if (promptId) {
      try {
        await supabase
          .from("studio_prompts")
          .update({
            status: "plan_rejected",
            notes: `Unhandled error: ${error instanceof Error ? error.message : "Unknown"}`,
          })
          .eq("id", promptId);
      } catch {
        // Don't let secondary save fail the response
      }
    }

    return NextResponse.json(
      { error: "Server error: " + (error instanceof Error ? error.message : "Unknown"), promptId },
      { status: 500 }
    );
  }
}
