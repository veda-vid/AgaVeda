-- 030_fix_publish_select_and_storage.sql
-- Fix post/spark publish: owners can always SELECT their own rows after INSERT,
-- and align storage INSERT with {folder}/{uid}/… upload paths used by the app.

-- Posts: allow owners to read their own posts even if shop.is_active is false
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

-- Posts INSERT: keep publisher gate (seller / service_provider / super_admin)
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

-- Reels SELECT already open; ensure INSERT remains correct for shop XOR pro
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

-- Drop legacy storage INSERT that only allows {uid}/… (conflicts with reels/{uid}/…)
DROP POLICY IF EXISTS "storage_upload_own_folder" ON storage.objects;

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
