// ScenePlan Schema v2 — Single source of truth
// Claude API generates this. Remotion consumes it. Database stores it.

import { z } from "zod";

// ============ ZOD SCHEMAS (runtime validation) ============

export const SceneSchema = z.object({
  id: z.enum([
    "scene1_materializes",
    "scene2_pain_01",
    "scene3_pain_02",
    "scene4_action",
    "scene5_promise_01",
    "scene6_promise_02",
    "scene7_tagline",
    "scene8_wordmark",
  ]),
  order: z.number().int().min(1).max(8),
  frameStart: z.number().int().min(0).max(990),
  frameEnd: z.number().int().min(0).max(990),
  durationSeconds: z.number().positive(),
  visual: z.object({
    blob: z
      .object({
        state: z.enum([
          "hidden",
          "materializing",
          "breathing",
          "pulsing",
          "fading",
        ]),
        position: z.enum(["center", "top", "bottom", "left", "right"]),
        scale: z.number().min(0.5).max(1.5),
        opacity: z.number().min(0).max(1),
      })
      .optional(),
    copy: z
      .object({
        text: z.string(),
        style: z.enum(["serif_italic", "sans_display", "mono_label"]),
        size: z.enum(["sm", "md", "lg", "xl"]),
        position: z.enum(["center", "top", "bottom"]),
        emphasis: z
          .array(
            z.object({
              word: z.string(),
              style: z.enum(["italic", "bold"]),
            })
          )
          .optional(),
        animation: z.enum([
          "fade_in",
          "fade_up",
          "typewriter",
          "split_reveal",
        ]),
        animationDurationMs: z.number().positive(),
      })
      .optional(),
    uiElements: z
      .array(
        z.object({
          type: z.enum([
            "notification",
            "calendar_event",
            "chat_bubble",
            "phone_call",
            "dashboard",
          ]),
          content: z.string(),
          animationIn: z.enum(["slide", "fade", "pop"]),
          showFromFrame: z.number().int().min(0),
          showUntilFrame: z.number().int(),
        })
      )
      .optional(),
    background: z.enum(["solid_dark", "gradient", "subtle_noise"]),
  }),
  audio: z.object({
    voText: z.string().optional(),
    voEmotion: z.enum([
      "thoughtful",
      "firm",
      "warm",
      "reassuring",
      "declarative",
      "soft",
      "urgent",
      "bold",
      "playful",
    ]),
    sfxRequests: z
      .array(
        z.object({
          searchTerm: z.string(),
          frameOffset: z.number().int().min(0),
          volume: z.number().min(0).max(1),
          purpose: z.string(),
        })
      )
      .optional(),
  }),
  reasoning: z.string(),
});

export const ScenePlanSchema = z.object({
  meta: z.object({
    videoType: z.literal("launch_v1"),
    language: z.enum(["en", "nl", "de"]),
    totalFrames: z.literal(990),
    totalDurationSeconds: z.literal(33),
    aspectRatio: z.literal("1920x1080"),
    fps: z.literal(30),
    brand: z.object({
      name: z.literal("Vocito"),
      wordmark: z.literal("VOCITO"),
      accentColor: z.literal("#a78bff"),
      successColor: z.literal("#5eead4"),
      backgroundColor: z.literal("#05060a"),
    }),
    rawPrompt: z.string(),
    interpretedIntent: z.string(),
  }),
  audio: z.object({
    music: z.object({
      searchQuery: z.string(),
      mood: z.enum([
        "mysterious",
        "melancholic",
        "tech_driving",
        "hopeful",
        "triumphant",
        "cinematic",
        "corporate",
        "ambient",
      ]),
      energyStart: z.number().int().min(1).max(10),
      energyEnd: z.number().int().min(1).max(10),
      bpmMin: z.number().int().optional(),
      bpmMax: z.number().int().optional(),
      instruments: z.array(z.string()).optional(),
      hasVocals: z.literal(false),
    }),
    voiceover: z.object({
      voiceId: z.string(),
      speed: z.number().min(0.8).max(1.1),
      fullScript: z.string(),
      estimatedDurationSeconds: z.number().positive(),
    }),
    mixLevels: z.object({
      musicBase: z.number().min(0).max(1),
      musicDuckedDuringVO: z.number().min(0).max(1),
      voVolume: z.number().min(0).max(1),
      sfxVolume: z.number().min(0).max(1),
    }),
  }),
  scenes: z.array(SceneSchema).length(8),
});

// ============ INFERRED TYPES ============

export type ScenePlan = z.infer<typeof ScenePlanSchema>;
export type Scene = z.infer<typeof SceneSchema>;

export type Language = ScenePlan["meta"]["language"];
export type VideoType = ScenePlan["meta"]["videoType"];
export type Emotion = Scene["audio"]["voEmotion"];
export type Mood = ScenePlan["audio"]["music"]["mood"];
export type SceneId = Scene["id"];
export type BlobState = NonNullable<Scene["visual"]["blob"]>["state"];
export type CopyStyle = NonNullable<Scene["visual"]["copy"]>["style"];
export type CopyAnimation = NonNullable<Scene["visual"]["copy"]>["animation"];
export type BackgroundType = Scene["visual"]["background"];
