-- 028_seller_publish_and_reel_audio.sql
-- Fix Spark (reels) publish: missing audio columns + seller/pro RLS + storage path alignment
-- Maps product "sparks" → public.reels; "sellers" → shops owned by auth.uid()

-- ─── Reel audio columns (required by createReel / Music picker) ───────────────
ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS audio_track_id TEXT,
  ADD COLUMN IF NOT EXISTS audio_title TEXT,
  ADD COLUMN IF NOT EXISTS audio_artist TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_start_time DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_volume_balance JSONB DEFAULT '{"video":0,"music":100}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_reels_audio_track ON public.reels(audio_track_id);

-- ─── Helper: active non-suspended seller / service pro ───────────────────────
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

-- ─── Reels INSERT: sellers (shop owners) + service pros ─────────────────────
DROP POLICY IF EXISTS "reels_insert_own" ON public.reels;
DROP POLICY IF EXISTS "Sellers can insert sparks" ON public.reels;
CREATE POLICY "reels_insert_own"
  ON public.reels FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_publisher()
    AND (
      shop_id IN (
        SELECT s.id FROM public.shops s
        WHERE s.owner_id = auth.uid()
      )
      OR service_provider_id IN (
        SELECT sp.id FROM public.service_providers sp
        WHERE sp.profile_id = auth.uid()
      )
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    )
  );

-- Allow authors to update their own Sparks (caption / audio metadata)
DROP POLICY IF EXISTS "reels_update_own" ON public.reels;
CREATE POLICY "reels_update_own"
  ON public.reels FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- ─── Posts INSERT: keep shop/pro ownership, require active publisher ─────────
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

-- ─── Stories INSERT: same publisher gate ────────────────────────────────────
DROP POLICY IF EXISTS "stories_insert_own" ON public.stories;
CREATE POLICY "stories_insert_own"
  ON public.stories FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_publisher()
    AND (
      shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
      OR service_provider_id IN (
        SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
      )
    )
  );

-- ─── Storage: allow both {uid}/… and {folder}/{uid}/… upload layouts ────────
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
