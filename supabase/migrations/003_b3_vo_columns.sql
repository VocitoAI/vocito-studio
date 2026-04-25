-- B3: Add VO-specific columns to studio_assets
-- Run in Supabase Dashboard → SQL Editor

-- Extend asset_type check to include 'vo'
ALTER TABLE studio_assets DROP CONSTRAINT IF EXISTS studio_assets_asset_type_check;
ALTER TABLE studio_assets ADD CONSTRAINT studio_assets_asset_type_check
  CHECK (asset_type IN ('music', 'sfx', 'voice', 'vo_generated', 'vo'));

-- Add VO-specific columns
ALTER TABLE studio_assets
  ADD COLUMN IF NOT EXISTS vo_provider TEXT,
  ADD COLUMN IF NOT EXISTS vo_language TEXT,
  ADD COLUMN IF NOT EXISTS vo_voice_id TEXT,
  ADD COLUMN IF NOT EXISTS vo_text_hash TEXT;

CREATE INDEX IF NOT EXISTS studio_assets_vo_text_hash_idx
  ON studio_assets(vo_text_hash) WHERE vo_text_hash IS NOT NULL;

-- Also add download_status if missing (might exist from A3)
-- This is idempotent
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'studio_assets' AND column_name = 'download_status'
  ) THEN
    ALTER TABLE studio_assets ADD COLUMN download_status TEXT DEFAULT 'ready';
  END IF;
END $$;
