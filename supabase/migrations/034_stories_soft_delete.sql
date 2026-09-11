-- 034_stories_soft_delete.sql
-- Soft-delete stories (user can hide their own without hard delete)

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stories_active
  ON public.stories (expires_at DESC)
  WHERE deleted_at IS NULL;

-- Active stories only (exclude soft-deleted)
DROP POLICY IF EXISTS "stories_select_active" ON public.stories;
CREATE POLICY "stories_select_active"
  ON public.stories FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (expires_at > now() OR author_id = auth.uid())
  );

-- Authors can soft-delete (UPDATE deleted_at) their own stories
DROP POLICY IF EXISTS "stories_update_own" ON public.stories;
CREATE POLICY "stories_update_own"
  ON public.stories FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Keep hard-delete policy for authors who still want it (optional cleanup)
DROP POLICY IF EXISTS "stories_delete_own" ON public.stories;
CREATE POLICY "stories_delete_own"
  ON public.stories FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- Feed RPC: hide soft-deleted; support shop + service-pro stories
CREATE OR REPLACE FUNCTION public.stories_for_user(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  shop_id UUID,
  author_id UUID,
  media_url TEXT,
  media_type TEXT,
  caption TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  shop_name TEXT,
  shop_logo TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    st.id,
    st.shop_id,
    st.author_id,
    st.media_url,
    st.media_type,
    st.caption,
    st.expires_at,
    st.created_at,
    COALESCE(s.name, sp.business_name) AS shop_name,
    s.logo_url AS shop_logo
  FROM public.stories st
  LEFT JOIN public.shops s ON s.id = st.shop_id
  LEFT JOIN public.service_providers sp ON sp.id = st.service_provider_id
  WHERE st.expires_at > NOW()
    AND st.deleted_at IS NULL
    AND (
      st.author_id = p_user_id
      OR st.shop_id IN (
        SELECT shop_id FROM public.shop_followers WHERE user_id = p_user_id
      )
      OR (
        st.service_provider_id IS NOT NULL
        AND st.author_id = p_user_id
      )
    )
  ORDER BY st.created_at DESC;
$$;
