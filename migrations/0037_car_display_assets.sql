-- Presentation derivative only. Apply before deploying code that writes car_display.
BEGIN;
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_kind_check;
ALTER TABLE assets ADD CONSTRAINT assets_kind_check
    CHECK (kind IN ('car_original', 'car_display', 'rim_original', 'result'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_car_display_job_unique
    ON assets(job_id) WHERE kind = 'car_display' AND job_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_car_display_draft_unique
    ON assets(render_input_draft_id)
    WHERE kind = 'car_display' AND render_input_draft_id IS NOT NULL;
COMMIT;
