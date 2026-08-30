-- Durable Wan task identifier for provider support/reconciliation evidence.
-- The jobs table remains the single render lifecycle aggregate.

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS provider_task_id TEXT;
