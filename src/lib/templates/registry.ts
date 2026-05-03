/**
 * Template registry — mirrors worker/templates/registry.py.
 * Single source of truth for frontend template awareness.
 */

export type SceneSpec = {
  id: string;
  frameStart: number;
  frameEnd: number;
  role: string;
};

export type TemplateSpec = {
  id: string;
  name: string;
  durationSeconds: number;
  fps: number;
  totalFrames: number;
  aspectRatio: string;
  width: number;
  height: number;
  scenes: SceneSpec[];
  extraMetaFields: string[];
  remotionCompositionId: string;
  description: string;
};

export const TEMPLATES: Record<string, TemplateSpec> = {
  launch_v1: {
    id: "launch_v1",
    name: "Launch Video",
    durationSeconds: 33,
    fps: 30,
    totalFrames: 990,
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    scenes: [
      { id: "scene1_materializes", frameStart: 0, frameEnd: 90, role: "opener" },
      { id: "scene2_pain_01", frameStart: 90, frameEnd: 180, role: "pain" },
      { id: "scene3_pain_02", frameStart: 180, frameEnd: 270, role: "pain" },
      { id: "scene4_action", frameStart: 270, frameEnd: 450, role: "action" },
      { id: "scene5_promise_01", frameStart: 450, frameEnd: 570, role: "promise" },
      { id: "scene6_promise_02", frameStart: 570, frameEnd: 690, role: "promise" },
      { id: "scene7_tagline", frameStart: 690, frameEnd: 870, role: "tagline" },
      { id: "scene8_wordmark", frameStart: 870, frameEnd: 990, role: "wordmark" },
    ],
    extraMetaFields: [],
    remotionCompositionId: "VocitoLaunchVideo",
    description: "General Vocito launch film",
  },
  marketing_niche: {
    id: "marketing_niche",
    name: "Niche Marketing",
    durationSeconds: 30,
    fps: 30,
    totalFrames: 900,
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    scenes: [
      { id: "scene1_opener", frameStart: 0, frameEnd: 90, role: "opener" },
      { id: "scene2_niche_pain", frameStart: 90, frameEnd: 240, role: "pain" },
      { id: "scene3_niche_solution", frameStart: 240, frameEnd: 420, role: "action" },
      { id: "scene4_demo", frameStart: 420, frameEnd: 570, role: "demo" },
      { id: "scene5_customer_quote", frameStart: 570, frameEnd: 720, role: "quote" },
      { id: "scene6_cta", frameStart: 720, frameEnd: 840, role: "cta" },
      { id: "scene7_wordmark", frameStart: 840, frameEnd: 900, role: "wordmark" },
    ],
    extraMetaFields: ["niche", "cta"],
    remotionCompositionId: "VocitoNicheVideo",
    description: "Industry-specific marketing",
  },
  testimonial: {
    id: "testimonial",
    name: "Testimonial",
    durationSeconds: 45,
    fps: 30,
    totalFrames: 1350,
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    scenes: [
      { id: "scene1_intro_blob", frameStart: 0, frameEnd: 120, role: "opener" },
      { id: "scene2_customer_intro", frameStart: 120, frameEnd: 360, role: "intro" },
      { id: "scene3_problem", frameStart: 360, frameEnd: 600, role: "pain" },
      { id: "scene4_solution_quote", frameStart: 600, frameEnd: 900, role: "quote" },
      { id: "scene5_outcome", frameStart: 900, frameEnd: 1230, role: "promise" },
      { id: "scene6_wordmark", frameStart: 1230, frameEnd: 1350, role: "wordmark" },
    ],
    extraMetaFields: ["customerName", "customerRole", "customerCompany"],
    remotionCompositionId: "VocitoTestimonial",
    description: "Client story",
  },
  ad_short: {
    id: "ad_short",
    name: "Ad Short (9:16)",
    durationSeconds: 15,
    fps: 30,
    totalFrames: 450,
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    scenes: [
      { id: "scene1_hook", frameStart: 0, frameEnd: 90, role: "hook" },
      { id: "scene2_problem", frameStart: 90, frameEnd: 210, role: "pain" },
      { id: "scene3_solution", frameStart: 210, frameEnd: 360, role: "action" },
      { id: "scene4_cta", frameStart: 360, frameEnd: 450, role: "cta" },
    ],
    extraMetaFields: ["cta_url", "urgency_level"],
    remotionCompositionId: "VocitoAdShort",
    description: "TikTok / Reels vertical",
  },
  universal: {
    id: "universal",
    name: "Universal (Dynamic)",
    durationSeconds: 30,
    fps: 30,
    totalFrames: 900,
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    scenes: [], // Claude decides scene structure
    extraMetaFields: [],
    remotionCompositionId: "VocitoUniversal",
    description: "Fully dynamic — Claude decides structure, scenes, and timing",
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export function getTemplate(templateId: string): TemplateSpec {
  const t = TEMPLATES[templateId];
  // Fallback to universal for unknown templates
  if (!t) return TEMPLATES.universal;
  return t;
}
