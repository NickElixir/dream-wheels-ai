-- Shared public catalog references only. User uploads remain in private raw.
-- Generated initially with supabase migration new, numbered for this repository.
-- Apply separately after review; do not run from the frontend build/publisher.
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('catalog-wheels', 'catalog-wheels', true, 8388608,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets
        WHERE id = 'catalog-wheels' AND name = 'catalog-wheels'
          AND public = true AND file_size_limit = 8388608
          AND allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
    ) THEN
        RAISE EXCEPTION 'Existing catalog-wheels bucket does not match reviewed configuration';
    END IF;
END $$;

-- Existing permissive policies can cover all buckets except raw.
-- A restrictive policy is required: another permissive false policy is insufficient.
-- Public object GET bypasses RLS; listing and client mutations stay blocked.
DROP POLICY IF EXISTS "catalog wheels: clients no access" ON storage.objects;
CREATE POLICY "catalog wheels: clients no access"
    ON storage.objects AS RESTRICTIVE FOR ALL
    TO anon, authenticated
    USING (bucket_id <> 'catalog-wheels')
    WITH CHECK (bucket_id <> 'catalog-wheels');

COMMIT;
