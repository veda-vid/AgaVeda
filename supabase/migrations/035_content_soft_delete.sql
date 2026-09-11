-- Soft-delete for posts, reels (moments), stories via SECURITY DEFINER RPCs.
-- Avoids RLS failures when UPDATE ... RETURNING cannot SELECT soft-deleted rows.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_active
  ON public.posts (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reels_active
  ON public.reels (created_at DESC)
  WHERE deleted_at IS NULL;

-- ── SELECT: hide soft-deleted from clients ─────────────────────────────────
DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
CREATE POLICY "posts_select_all"
  ON public.posts FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      shop_id IN (SELECT shops.id FROM shops WHERE shops.is_active = true)
      OR shop_id IN (SELECT shops.id FROM shops WHERE shops.owner_id = auth.uid())
      OR service_provider_id IS NOT NULL
      OR service_provider_id IN (
        SELECT service_providers.id FROM service_providers
        WHERE service_providers.profile_id = auth.uid()
      )
      OR (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "reels_select_all" ON public.reels;
CREATE POLICY "reels_select_all"
  ON public.reels FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "reels_select_anon" ON public.reels;
CREATE POLICY "reels_select_anon"
  ON public.reels FOR SELECT TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "stories_select_active" ON public.stories;
CREATE POLICY "stories_select_active"
  ON public.stories FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (expires_at > now() OR author_id = auth.uid())
  );

DROP POLICY IF EXISTS "stories_update_own" ON public.stories;
CREATE POLICY "stories_update_own"
  ON public.stories FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "reels_update_own" ON public.reels;
CREATE POLICY "reels_update_own"
  ON public.reels FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
    OR service_provider_id IN (
      SELECT id FROM service_providers WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    OR shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
    OR service_provider_id IN (
      SELECT id FROM service_providers WHERE profile_id = auth.uid()
    )
  );

-- ── Soft-delete RPCs (SECURITY DEFINER) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_story(p_story_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  updated INT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.stories st
  SET deleted_at = NOW()
  WHERE st.id = p_story_id
    AND st.deleted_at IS NULL
    AND (
      st.author_id = uid
      OR st.shop_id IN (SELECT id FROM public.shops WHERE owner_id = uid)
      OR st.service_provider_id IN (
        SELECT id FROM public.service_providers WHERE profile_id = uid
      )
    );

  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated = 0 THEN
    RAISE EXCEPTION 'Story not found or not allowed to delete' USING ERRCODE = '42501';
  END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_reel(p_reel_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  updated INT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.reels r
  SET deleted_at = NOW()
  WHERE r.id = p_reel_id
    AND r.deleted_at IS NULL
    AND (
      r.author_id = uid
      OR r.shop_id IN (SELECT id FROM public.shops WHERE owner_id = uid)
      OR r.service_provider_id IN (
        SELECT id FROM public.service_providers WHERE profile_id = uid
      )
    );

  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated = 0 THEN
    RAISE EXCEPTION 'Moment not found or not allowed to delete' USING ERRCODE = '42501';
  END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_post(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  updated INT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.posts p
  SET deleted_at = NOW()
  WHERE p.id = p_post_id
    AND p.deleted_at IS NULL
    AND (
      p.shop_id IN (SELECT id FROM public.shops WHERE owner_id = uid)
      OR p.service_provider_id IN (
        SELECT id FROM public.service_providers WHERE profile_id = uid
      )
      OR (SELECT role FROM public.profiles WHERE id = uid) = 'super_admin'
    );

  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated = 0 THEN
    RAISE EXCEPTION 'Post not found or not allowed to delete' USING ERRCODE = '42501';
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_story(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_reel(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_post(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_story(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_reel(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_post(UUID) TO authenticated;

-- ── Feeds: exclude soft-deleted ────────────────────────────────────────────
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

CREATE OR REPLACE FUNCTION public.feed_from_followed(p_user_id uuid)
RETURNS TABLE(
  id uuid, shop_id uuid, product_id uuid, caption text, media_urls text[],
  media_type text, is_ad boolean, ad_cta_text text, ad_cta_url text,
  total_likes integer, total_comments integer, created_at timestamptz,
  shop_name text, shop_logo text, shop_category text, shop_avg_rating numeric,
  shop_is_open boolean, distance_km double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT p.id, p.shop_id, p.product_id, p.caption,
         p.media_urls, p.media_type, p.is_ad, p.ad_cta_text, p.ad_cta_url,
         p.total_likes, p.total_comments, p.created_at,
         s.name, s.logo_url, s.category, s.avg_rating, s.is_open,
         0::FLOAT AS distance_km
  FROM public.posts p
  JOIN public.shops s ON s.id = p.shop_id
  JOIN public.shop_followers f ON f.shop_id = p.shop_id AND f.user_id = p_user_id
  WHERE s.is_active = true
    AND p.deleted_at IS NULL
  ORDER BY p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.feed_within_radius(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision
)
RETURNS TABLE(
  id uuid, shop_id uuid, product_id uuid, caption text, media_urls text[],
  media_type text, is_ad boolean, ad_cta_text text, ad_cta_url text,
  total_likes integer, total_comments integer, created_at timestamptz,
  shop_name text, shop_logo text, shop_category text, shop_avg_rating numeric,
  shop_is_open boolean, distance_km double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT p.id, p.shop_id, p.product_id, p.caption,
         p.media_urls, p.media_type, p.is_ad, p.ad_cta_text, p.ad_cta_url,
         p.total_likes, p.total_comments, p.created_at,
         s.name, s.logo_url, s.category, s.avg_rating, s.is_open,
         ST_Distance(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography) / 1000 AS distance_km
  FROM public.posts p
  JOIN public.shops s ON s.id = p.shop_id
  WHERE s.is_active = true
    AND p.deleted_at IS NULL
    AND ST_DWithin(
      s.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography,
      radius_km * 1000
    )
  ORDER BY p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_unified_sparks_feed(
  p_user_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_shop_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT *
    FROM (
      SELECT
        r.id::text AS id,
        'reel'::text AS source_type,
        r.id AS reel_id,
        NULL::uuid AS post_id,
        r.shop_id,
        r.author_id,
        r.media_url,
        r.caption,
        COALESCE(r.tags, '{}'::text[]) AS tags,
        r.created_at,
        s.name AS shop_name,
        s.logo_url AS shop_logo,
        r.total_likes AS likes_count,
        r.total_comments AS comments_count,
        (
          COALESCE((SELECT COUNT(*)::int FROM public.spark_reposts sr WHERE sr.spark_id = r.id), 0)
          + COALESCE((
            SELECT COUNT(*)::int FROM public.reposts rp
            WHERE rp.spark_id = r.id AND rp.content_type = 'spark'
          ), 0)
        ) AS reposts_count,
        CASE WHEN p_user_id IS NULL THEN false
          ELSE EXISTS(SELECT 1 FROM public.spark_likes sl WHERE sl.spark_id = r.id AND sl.user_id = p_user_id)
        END AS is_liked,
        CASE WHEN p_user_id IS NULL THEN false
          ELSE (
            EXISTS(SELECT 1 FROM public.spark_reposts sr WHERE sr.spark_id = r.id AND sr.user_id = p_user_id)
            OR EXISTS(
              SELECT 1 FROM public.reposts rp
              WHERE rp.spark_id = r.id AND rp.user_id = p_user_id AND rp.content_type = 'spark'
            )
          )
        END AS is_reposted,
        CASE WHEN p_user_id IS NULL THEN false
          ELSE EXISTS(SELECT 1 FROM public.shop_followers sf WHERE sf.shop_id = r.shop_id AND sf.user_id = p_user_id)
        END AS is_followed,
        r.product_id,
        pr.title AS product_title,
        pr.price AS product_price,
        pr.discounted_price AS product_discounted_price,
        CASE
          WHEN pr.images IS NOT NULL AND array_length(pr.images, 1) > 0 THEN pr.images[1]
          ELSE NULL
        END AS product_image

      FROM public.reels r
      JOIN public.shops s ON s.id = r.shop_id
      LEFT JOIN public.products pr ON pr.id = r.product_id
      WHERE r.deleted_at IS NULL
        AND (
          p_shop_ids IS NULL
          OR cardinality(p_shop_ids) = 0
          OR r.shop_id = ANY(p_shop_ids)
        )

      UNION ALL

      SELECT
        'post-spark-' || p.id AS id,
        'post'::text AS source_type,
        NULL::uuid AS reel_id,
        p.id AS post_id,
        p.shop_id,
        s.owner_id AS author_id,
        COALESCE(p.media_urls[1], '') AS media_url,
        p.caption,
        '{}'::text[] AS tags,
        p.created_at,
        s.name AS shop_name,
        s.logo_url AS shop_logo,
        p.total_likes AS likes_count,
        p.total_comments AS comments_count,
        COALESCE((SELECT COUNT(*)::int FROM public.reposts rp WHERE rp.post_id = p.id), 0) AS reposts_count,
        CASE WHEN p_user_id IS NULL THEN false
          ELSE EXISTS(SELECT 1 FROM public.post_likes pl WHERE pl.post_id = p.id AND pl.user_id = p_user_id)
        END AS is_liked,
        CASE WHEN p_user_id IS NULL THEN false
          ELSE EXISTS(SELECT 1 FROM public.reposts rp WHERE rp.post_id = p.id AND rp.user_id = p_user_id)
        END AS is_reposted,
        CASE WHEN p_user_id IS NULL THEN false
          ELSE EXISTS(SELECT 1 FROM public.shop_followers sf WHERE sf.shop_id = p.shop_id AND sf.user_id = p_user_id)
        END AS is_followed,
        p.product_id,
        pr.title AS product_title,
        pr.price AS product_price,
        pr.discounted_price AS product_discounted_price,
        CASE
          WHEN pr.images IS NOT NULL AND array_length(pr.images, 1) > 0 THEN pr.images[1]
          ELSE NULL
        END AS product_image

      FROM public.posts p
      JOIN public.shops s ON s.id = p.shop_id
      LEFT JOIN public.products pr ON pr.id = p.product_id
      WHERE p.deleted_at IS NULL
        AND NOT p.is_ad
        AND p.caption NOT LIKE '__TEXT_CARD__%'
        AND (
          p.media_type = 'video'
          OR EXISTS (
            SELECT 1 FROM unnest(p.media_urls) AS u(url)
            WHERE u.url ~* '\.(mp4|mov|webm|m4v)(\?|$)'
          )
        )
        AND COALESCE(array_length(p.media_urls, 1), 0) > 0
        AND (
          p_shop_ids IS NULL
          OR cardinality(p_shop_ids) = 0
          OR p.shop_id = ANY(p_shop_ids)
        )
    ) combined
    WHERE combined.media_url IS NOT NULL AND btrim(combined.media_url) <> ''
    ORDER BY combined.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0)
  ) t;

  RETURN result;
END;
$function$;
