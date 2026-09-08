-- 05B.1: persist the application surface and validated browser return route.
-- Historical payments are from the legacy Telegram-first flow on staging.

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS client_channel TEXT,
    ADD COLUMN IF NOT EXISTS return_to TEXT;

UPDATE payments
SET client_channel = 'telegram'
WHERE client_channel IS NULL OR btrim(client_channel) = '';

UPDATE payments
SET return_to = '/t/'
WHERE return_to IS NULL OR btrim(return_to) = '';

ALTER TABLE payments
    ALTER COLUMN client_channel SET DEFAULT 'telegram',
    ALTER COLUMN client_channel SET NOT NULL,
    ALTER COLUMN return_to SET DEFAULT '/t/',
    ALTER COLUMN return_to SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payments_client_channel_check'
          AND conrelid = 'payments'::regclass
    ) THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_client_channel_check
            CHECK (client_channel IN ('web', 'telegram'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payments_return_to_nonempty_check'
          AND conrelid = 'payments'::regclass
    ) THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_return_to_nonempty_check
            CHECK (btrim(return_to) <> '');
    END IF;
END
$$;
