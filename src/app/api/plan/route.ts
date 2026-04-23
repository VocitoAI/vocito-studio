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

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      system: SCENE_PLAN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserMessage({ rawPrompt, language }),
        },
      ],
    });

    // Extract text from response
    const textContent = response.content.find((b) => b.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    const rawText = textContent.text;
    console.log(
      "[/api/plan] Claude raw output (first 500 chars):",
      rawText.slice(0, 500)
    );

    // Parse JSON
    let scenePlanJson;
    try {
      scenePlanJson = JSON.parse(rawText);
    } catch (parseError) {
      // Try stripping markdown fences
      const cleaned = rawText
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();

      try {
        scenePlanJson = JSON.parse(cleaned);
      } catch {
        // JSON is completely unparseable — log raw text for debugging
        const errorNote = `JSON parse failed. Raw output (first 1000 chars): ${rawText.slice(0, 1000)}`;
        console.error("[/api/plan] JSON parse error:", parseError);
        console.error("[/api/plan] Raw Claude output:", rawText.slice(0, 1000));

        await supabase
          .from("studio_prompts")
          .update({
            status: "plan_rejected",
            notes: errorNote,
          })
          .eq("id", promptId);

        return NextResponse.json(
          {
            error: "Claude returned invalid JSON",
            promptId,
            debug: rawText.slice(0, 300),
          },
          { status: 500 }
        );
      }
    }

    // Validate against Zod schema
    const parsed = ScenePlanSchema.safeParse(scenePlanJson);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const issuesJson = JSON.stringify(issues, null, 2);

      console.error("[/api/plan] Zod validation failed. Issues:");
      console.error(issuesJson);
      console.error(
        "[/api/plan] Claude raw output (first 500 chars):",
        rawText.slice(0, 500)
      );

      // Save full issues to Supabase notes (up to 5000 chars)
      const notesContent = `Schema validation failed.\n\nIssues:\n${issuesJson.slice(0, 4000)}\n\nRaw output (first 500 chars):\n${rawText.slice(0, 500)}`;

      await supabase
        .from("studio_prompts")
        .update({
          status: "plan_rejected",
          notes: notesContent,
        })
        .eq("id", promptId);

      return NextResponse.json(
        {
          error: "Claude generated invalid ScenePlan",
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

    // Try to save error to Supabase if we have a prompt ID
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
        // Don't let this secondary save fail the response
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
