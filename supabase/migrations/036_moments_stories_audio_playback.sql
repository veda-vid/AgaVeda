-- Persist + return latched music for Moments feed and Stories

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS audio_track_id TEXT,
  ADD COLUMN IF NOT EXISTS audio_title TEXT,
  ADD COLUMN IF NOT EXISTS audio_artist TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_start_time DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_volume_balance JSONB DEFAULT '{"video":0,"music":100}'::jsonb;

DROP FUNCTION IF EXISTS public.stories_for_user(UUID);

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
  shop_logo TEXT,
  audio_track_id TEXT,
  audio_title TEXT,
  audio_artist TEXT,
  audio_url TEXT,
  audio_start_time DOUBLE PRECISION,
  audio_volume_balance JSONB
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
    s.logo_url AS shop_logo,
    st.audio_track_id,
    st.audio_title,
    st.audio_artist,
    st.audio_url,
    COALESCE(st.audio_start_time, 0),
    COALESCE(st.audio_volume_balance, '{"video":0,"music":100}'::jsonb)
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
        END AS product_image,
        r.audio_track_id,
        r.audio_title,
        r.audio_artist,
        r.audio_url,
        COALESCE(r.audio_start_time, 0) AS audio_start_time,
        COALESCE(r.audio_volume_balance, '{"video":0,"music":100}'::jsonb) AS audio_volume_balance

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
        END AS product_image,
        NULL::text AS audio_track_id,
        NULL::text AS audio_title,
        NULL::text AS audio_artist,
        NULL::text AS audio_url,
        0::double precision AS audio_start_time,
        '{"video":100,"music":0}'::jsonb AS audio_volume_balance

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
