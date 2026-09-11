-- 029_spark_publish_rls_hardening.sql
-- Product "Sparks" map to public.reels. Harden INSERT RLS for sellers / service pros
-- and ensure audio segment columns used by the mobile publisher are present.

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS audio_track_id TEXT,
  ADD COLUMN IF NOT EXISTS audio_title TEXT,
  ADD COLUMN IF NOT EXISTS audio_artist TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_start_time DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_volume_balance JSONB DEFAULT '{"video":0,"music":100}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_reels_audio_track ON public.reels(audio_track_id);

-- Active publisher gate (seller / service_provider / super_admin, not suspended)
CREATE OR REPLACE FUNCTION public.is_active_publisher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.is_suspended, false) = false
      AND p.role IN ('seller', 'service_provider', 'super_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_publisher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_publisher() TO anon;

-- Reels INSERT: authenticated authors who own the shop or service-pro profile
DROP POLICY IF EXISTS "reels_insert_own" ON public.reels;
DROP POLICY IF EXISTS "Sellers can insert sparks" ON public.reels;
DROP POLICY IF EXISTS "Authenticated users can insert sparks" ON public.reels;

CREATE POLICY "reels_insert_own"
  ON public.reels FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_publisher()
    AND (
      (
        shop_id IS NOT NULL
        AND service_provider_id IS NULL
        AND shop_id IN (
          SELECT s.id FROM public.shops s
          WHERE s.owner_id = auth.uid()
        )
      )
      OR (
        service_provider_id IS NOT NULL
        AND shop_id IS NULL
        AND service_provider_id IN (
          SELECT sp.id FROM public.service_providers sp
          WHERE sp.profile_id = auth.uid()
        )
      )
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "reels_update_own" ON public.reels;
CREATE POLICY "reels_update_own"
  ON public.reels FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Storage path layouts used by uploadMediaUrl: {folder}/{uid}/…
DROP POLICY IF EXISTS "storage_objects_insert_cityconnect" ON storage.objects;
CREATE POLICY "storage_objects_insert_cityconnect"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cityconnect'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "storage_objects_update_cityconnect" ON storage.objects;
CREATE POLICY "storage_objects_update_cityconnect"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cityconnect'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  )
  WITH CHECK (
    bucket_id = 'cityconnect'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "storage_objects_select_cityconnect" ON storage.objects;
CREATE POLICY "storage_objects_select_cityconnect"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cityconnect');

-- Also allow anon read for published Spark media URLs
DROP POLICY IF EXISTS "storage_objects_select_cityconnect_anon" ON storage.objects;
CREATE POLICY "storage_objects_select_cityconnect_anon"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'cityconnect');
