-- UI-007: stable per-owner numbers; apply before deploying the API reader.
-- Take a short write pause: retry the whole transaction if lock_timeout is hit.
BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE public.users, public.jobs IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_try_on_number bigint NOT NULL DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS try_on_number bigint;

-- Preserve any previously issued number when this migration is run again.
WITH numbered AS (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS number
    FROM public.jobs WHERE user_id IS NOT NULL
)
UPDATE public.jobs j SET try_on_number = n.number
FROM numbered n WHERE j.id = n.id AND j.try_on_number IS NULL;

UPDATE public.users u SET last_try_on_number = GREATEST(
    u.last_try_on_number,
    COALESCE((SELECT max(j.try_on_number) FROM public.jobs j WHERE j.user_id = u.id), 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_owner_try_on_number_unique
    ON public.jobs(user_id, try_on_number);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.jobs'::regclass
                   AND conname = 'jobs_owner_try_on_number_check') THEN
        ALTER TABLE public.jobs ADD CONSTRAINT jobs_owner_try_on_number_check
            CHECK ((user_id IS NULL AND try_on_number IS NULL)
                OR (user_id IS NOT NULL AND try_on_number > 0 AND try_on_number IS NOT NULL));
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.assign_try_on_number() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
        IF NEW.try_on_number IS DISTINCT FROM OLD.try_on_number THEN
            RAISE EXCEPTION 'Try-on number is immutable for its owner';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.user_id IS NULL THEN
        NEW.try_on_number := NULL;
        RETURN NEW;
    END IF;
    UPDATE public.users SET last_try_on_number = last_try_on_number + 1
    WHERE id = NEW.user_id AND merged_into_user_id IS NULL
    RETURNING last_try_on_number INTO NEW.try_on_number;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Try-on owner is missing or merged';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS jobs_assign_try_on_number ON public.jobs;
CREATE TRIGGER jobs_assign_try_on_number
    BEFORE INSERT OR UPDATE OF user_id, try_on_number ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.assign_try_on_number();
COMMIT;
