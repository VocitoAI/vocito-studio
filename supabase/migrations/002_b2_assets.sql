-- B2: Asset resolution tables and columns
-- Run in Supabase Dashboard → SQL Editor

-- Extend studio_prompts with asset tracking columns
ALTER TABLE studio_prompts
  ADD COLUMN IF NOT EXISTS assets_status TEXT
    CHECK (assets_status IN ('pending', 'downloading', 'ready', 'partial', 'failed')),
  ADD COLUMN IF NOT EXISTS assets_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assets_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assets_error TEXT;

-- Junction table: prompt → assets
CREATE TABLE IF NOT EXISTS studio_prompt_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prompt_id UUID NOT NULL REFERENCES studio_prompts(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES studio_assets(id) ON DELETE CASCADE,
  usage_context TEXT NOT NULL,
  scene_id TEXT,
  frame_offset INTEGER,
  volume NUMERIC,
  UNIQUE(prompt_id, usage_context)
);

CREATE INDEX IF NOT EXISTS idx_studio_prompt_assets_prompt
  ON studio_prompt_assets(prompt_id);

ALTER TABLE studio_prompt_assets ENABLE ROW LEVEL SECURITY;
