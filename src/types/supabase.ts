export type PromptStatus =
  | "draft"
  | "plan_pending"
  | "plan_ready"
  | "plan_approved"
  | "plan_rejected";

export type RunStatus =
  | "pending"
  | "planning"
  | "downloading"
  | "generating_vo"
  | "rendering"
  | "uploading"
  | "completed"
  | "failed"
  | "cancelled";

export type FeedbackCategory =
  | "visual"
  | "audio_music"
  | "audio_vo"
  | "audio_sfx"
  | "timing"
  | "copy"
  | "overall"
  | "other";

export type FeedbackSentiment = "positive" | "negative" | "neutral";

export type ReviewDecision = "approved" | "rejected";

export type AssetSource = "epidemic_sound" | "fish_audio" | "user_upload";
export type AssetType = "music" | "sfx" | "voice" | "vo_generated";

export interface StudioPrompt {
  id: string;
  created_at: string;
  updated_at: string;
  raw_prompt: string;
  language: string;
  scene_plan: Record<string, unknown> | null;
  status: PromptStatus;
  review_feedback: string | null;
  reviewed_at: string | null;
  notes: string | null;
}

export interface StudioVideoRun {
  id: string;
  created_at: string;
  updated_at: string;
  prompt_id: string | null;
  scene_plan: Record<string, unknown>;
  language: string;
  composition_id: string | null;
  music_recording_id: string | null;
  music_url: string | null;
  voice_id: string | null;
  vo_url: string | null;
  sfx_assets: Record<string, unknown>[] | null;
  output_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  status: RunStatus;
  progress_percent: number;
  current_step: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  render_duration_ms: number | null;
  reviewed_at: string | null;
  review_decision: ReviewDecision | null;
  review_feedback: string | null;
  iteration_number: number;
  parent_run_id: string | null;
}

export interface StudioFeedback {
  id: string;
  created_at: string;
  run_id: string | null;
  category: FeedbackCategory;
  sentiment: FeedbackSentiment;
  comment: string | null;
  timestamp_seconds: number | null;
  is_blocking: boolean;
}

export interface StudioLearning {
  id: string;
  created_at: string;
  updated_at: string;
  category: string;
  pattern: string;
  recommendation: string;
  supporting_feedback_count: number;
  confidence_score: number;
  applies_to_scene_types: string[] | null;
  active: boolean;
}

export interface StudioAsset {
  id: string;
  created_at: string;
  last_used_at: string;
  source: AssetSource;
  external_id: string;
  asset_type: AssetType;
  title: string | null;
  duration_ms: number | null;
  bpm: number | null;
  mood: string | null;
  tags: string[] | null;
  supabase_storage_path: string | null;
  public_url: string | null;
  used_in_runs: number;
}
