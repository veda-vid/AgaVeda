-- 031_sparks_media_bucket_and_publish_rls.sql
-- Create sparks_media bucket + ensure sellers can insert Sparks (reels) / Posts / storage objects

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sparks_media',
  'sparks_media',
  true,
  104857600, -- 100MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Ensure cityconnect remains public for posts / avatars
UPDATE storage.buckets SET public = true WHERE id = 'cityconnect';

-- Active publisher helper
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

-- Reels (Sparks) INSERT
DROP POLICY IF EXISTS "reels_insert_own" ON public.reels;
CREATE POLICY "reels_insert_own"
  ON public.reels FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_publisher()
    AND (
      (
        shop_id IS NOT NULL
        AND service_provider_id IS NULL
        AND shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
      )
      OR (
        service_provider_id IS NOT NULL
        AND shop_id IS NULL
        AND service_provider_id IN (
          SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
        )
      )
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "reels_select_all" ON public.reels;
CREATE POLICY "reels_select_all"
  ON public.reels FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "reels_select_anon" ON public.reels;
CREATE POLICY "reels_select_anon"
  ON public.reels FOR SELECT TO anon
  USING (true);

-- Posts INSERT / SELECT
DROP POLICY IF EXISTS "posts_insert_shop_owner" ON public.posts;
CREATE POLICY "posts_insert_shop_owner"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_publisher()
    AND (
      shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
      OR service_provider_id IN (
        SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
      )
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
CREATE POLICY "posts_select_all"
  ON public.posts FOR SELECT TO authenticated
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE is_active = true)
    OR shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR service_provider_id IS NOT NULL
    OR service_provider_id IN (
      SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- Storage policies for sparks_media + cityconnect
DROP POLICY IF EXISTS "sparks_media_select" ON storage.objects;
CREATE POLICY "sparks_media_select"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id IN ('sparks_media', 'cityconnect'));

DROP POLICY IF EXISTS "sparks_media_insert" ON storage.objects;
CREATE POLICY "sparks_media_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('sparks_media', 'cityconnect')
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "sparks_media_update" ON storage.objects;
CREATE POLICY "sparks_media_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('sparks_media', 'cityconnect')
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  )
  WITH CHECK (
    bucket_id IN ('sparks_media', 'cityconnect')
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "sparks_media_delete" ON storage.objects;
CREATE POLICY "sparks_media_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('sparks_media', 'cityconnect')
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  );

-- Keep legacy cityconnect policies aligned
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
