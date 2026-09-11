-- Service pro profile fields + social content attached to service_provider_id

ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS base_rate_label TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_photos TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS service_provider_id UUID REFERENCES public.service_providers(id) ON DELETE CASCADE;

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS service_provider_id UUID REFERENCES public.service_providers(id) ON DELETE CASCADE;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS service_provider_id UUID REFERENCES public.service_providers(id) ON DELETE CASCADE;

ALTER TABLE public.stories ALTER COLUMN shop_id DROP NOT NULL;
ALTER TABLE public.reels ALTER COLUMN shop_id DROP NOT NULL;
ALTER TABLE public.posts ALTER COLUMN shop_id DROP NOT NULL;

ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_owner_check;
ALTER TABLE public.stories ADD CONSTRAINT stories_owner_check CHECK (
  (shop_id IS NOT NULL AND service_provider_id IS NULL)
  OR (shop_id IS NULL AND service_provider_id IS NOT NULL)
);

ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_owner_check;
ALTER TABLE public.reels ADD CONSTRAINT reels_owner_check CHECK (
  (shop_id IS NOT NULL AND service_provider_id IS NULL)
  OR (shop_id IS NULL AND service_provider_id IS NOT NULL)
);

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_owner_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_owner_check CHECK (
  (shop_id IS NOT NULL AND service_provider_id IS NULL)
  OR (shop_id IS NULL AND service_provider_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_stories_service_provider ON public.stories(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_reels_service_provider ON public.reels(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_posts_service_provider ON public.posts(service_provider_id);

-- Stories: allow service pro owners
DROP POLICY IF EXISTS "stories_insert_own" ON public.stories;
CREATE POLICY "stories_insert_own"
  ON public.stories FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
      OR service_provider_id IN (
        SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
      )
    )
  );

-- Reels: allow service pro owners
DROP POLICY IF EXISTS "reels_insert_own" ON public.reels;
CREATE POLICY "reels_insert_own"
  ON public.reels FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
      OR service_provider_id IN (
        SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
      )
    )
  );

-- Posts: allow service pro owners + show pro posts in feed
DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
CREATE POLICY "posts_select_all"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE is_active = true)
    OR service_provider_id IS NOT NULL
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "posts_insert_shop_owner" ON public.posts;
CREATE POLICY "posts_insert_shop_owner"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
      AND (SELECT is_suspended FROM public.profiles WHERE id = auth.uid()) = false
    )
    OR (
      service_provider_id IN (
        SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
      )
      AND (SELECT is_suspended FROM public.profiles WHERE id = auth.uid()) = false
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "posts_update_shop_owner" ON public.posts;
CREATE POLICY "posts_update_shop_owner"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR service_provider_id IN (
      SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR service_provider_id IN (
      SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "posts_delete_shop_owner" ON public.posts;
CREATE POLICY "posts_delete_shop_owner"
  ON public.posts FOR DELETE
  TO authenticated
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR service_provider_id IN (
      SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );
