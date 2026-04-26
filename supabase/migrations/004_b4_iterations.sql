-- B4: Iteration support for render review loop
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE studio_video_runs
  ADD COLUMN IF NOT EXISTS review_feedback_structured JSONB,
  ADD COLUMN IF NOT EXISTS iteration_label TEXT,
  ADD COLUMN IF NOT EXISTS regeneration_scope TEXT[];

CREATE INDEX IF NOT EXISTS studio_video_runs_parent_idx
  ON studio_video_runs(parent_run_id);
CREATE INDEX IF NOT EXISTS studio_video_runs_iteration_idx
  ON studio_video_runs(prompt_id, iteration_number);

-- Auto-set iteration_number and iteration_label
CREATE OR REPLACE FUNCTION set_iteration_metadata()
  RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.iteration_number IS NULL THEN
    SELECT COALESCE(MAX(iteration_number), 0) + 1
    INTO next_num
    FROM studio_video_runs
    WHERE prompt_id = NEW.prompt_id;

    NEW.iteration_number := next_num;
    NEW.iteration_label := 'V' || next_num;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_iteration_metadata ON studio_video_runs;
CREATE TRIGGER trg_iteration_metadata
  BEFORE INSERT ON studio_video_runs
  FOR EACH ROW
  EXECUTE FUNCTION set_iteration_metadata();
