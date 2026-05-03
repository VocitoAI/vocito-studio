"""
Template registry — single source of truth for all video templates.
Code-defined, not database. Version-controlled architecture.
"""
from dataclasses import dataclass, field


@dataclass
class SceneSpec:
    id: str
    frame_start: int
    frame_end: int
    role: str  # "opener", "pain", "action", "promise", "tagline", "wordmark", etc


@dataclass
class TemplateSpec:
    id: str
    name: str
    duration_seconds: int
    fps: int
    total_frames: int
    aspect_ratio: str
    width: int
    height: int
    scenes: list[SceneSpec]
    extra_meta_fields: list[str] = field(default_factory=list)
    remotion_composition_id: str = ""


TEMPLATES: dict[str, TemplateSpec] = {
    "launch_v1": TemplateSpec(
        id="launch_v1",
        name="Vocito Launch Video",
        duration_seconds=33,
        fps=30,
        total_frames=990,
        aspect_ratio="16:9",
        width=1920,
        height=1080,
        scenes=[
            SceneSpec("scene1_materializes", 0, 90, "opener"),
            SceneSpec("scene2_pain_01", 90, 180, "pain"),
            SceneSpec("scene3_pain_02", 180, 270, "pain"),
            SceneSpec("scene4_action", 270, 450, "action"),
            SceneSpec("scene5_promise_01", 450, 570, "promise"),
            SceneSpec("scene6_promise_02", 570, 690, "promise"),
            SceneSpec("scene7_tagline", 690, 870, "tagline"),
            SceneSpec("scene8_wordmark", 870, 990, "wordmark"),
        ],
        extra_meta_fields=[],
        remotion_composition_id="VocitoLaunchVideo",
    ),
    "marketing_niche": TemplateSpec(
        id="marketing_niche",
        name="Niche Marketing Video",
        duration_seconds=30,
        fps=30,
        total_frames=900,
        aspect_ratio="16:9",
        width=1920,
        height=1080,
        scenes=[
            SceneSpec("scene1_opener", 0, 90, "opener"),
            SceneSpec("scene2_niche_pain", 90, 240, "pain"),
            SceneSpec("scene3_niche_solution", 240, 420, "action"),
            SceneSpec("scene4_demo", 420, 570, "demo"),
            SceneSpec("scene5_customer_quote", 570, 720, "quote"),
            SceneSpec("scene6_cta", 720, 840, "cta"),
            SceneSpec("scene7_wordmark", 840, 900, "wordmark"),
        ],
        extra_meta_fields=["niche", "cta"],
        remotion_composition_id="VocitoNicheVideo",
    ),
    "testimonial": TemplateSpec(
        id="testimonial",
        name="Customer Testimonial",
        duration_seconds=45,
        fps=30,
        total_frames=1350,
        aspect_ratio="16:9",
        width=1920,
        height=1080,
        scenes=[
            SceneSpec("scene1_intro_blob", 0, 120, "opener"),
            SceneSpec("scene2_customer_intro", 120, 360, "intro"),
            SceneSpec("scene3_problem", 360, 600, "pain"),
            SceneSpec("scene4_solution_quote", 600, 900, "quote"),
            SceneSpec("scene5_outcome", 900, 1230, "promise"),
            SceneSpec("scene6_wordmark", 1230, 1350, "wordmark"),
        ],
        extra_meta_fields=["customerName", "customerRole", "customerCompany"],
        remotion_composition_id="VocitoTestimonial",
    ),
    "ad_short": TemplateSpec(
        id="ad_short",
        name="Vertical Ad Short",
        duration_seconds=15,
        fps=30,
        total_frames=450,
        aspect_ratio="9:16",
        width=1080,
        height=1920,
        scenes=[
            SceneSpec("scene1_hook", 0, 90, "hook"),
            SceneSpec("scene2_problem", 90, 210, "pain"),
            SceneSpec("scene3_solution", 210, 360, "action"),
            SceneSpec("scene4_cta", 360, 450, "cta"),
        ],
        extra_meta_fields=["cta_url", "urgency_level"],
        remotion_composition_id="VocitoAdShort",
    ),
    "universal": TemplateSpec(
        id="universal",
        name="Universal (Dynamic)",
        duration_seconds=30,
        fps=30,
        total_frames=900,
        aspect_ratio="16:9",
        width=1920,
        height=1080,
        scenes=[],  # Claude decides scene structure
        extra_meta_fields=[],
        remotion_composition_id="VocitoUniversal",
    ),
}


def get_template(template_id: str) -> TemplateSpec:
    """Get template by ID. Falls back to universal for unknown IDs."""
    if template_id not in TEMPLATES:
        return TEMPLATES["universal"]
    return TEMPLATES[template_id]


def get_scene_frames(template_id: str) -> dict[str, tuple[int, int]]:
    """Returns {scene_id: (frame_start, frame_end)} for VO concatenation."""
    template = get_template(template_id)
    return {s.id: (s.frame_start, s.frame_end) for s in template.scenes}
