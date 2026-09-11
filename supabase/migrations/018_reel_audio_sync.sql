-- Spark reel audio sync: trim start, volume balance, unified feed audio fields

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS audio_start_time DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_volume_balance JSONB DEFAULT '{"video":0,"music":100}'::jsonb;

CREATE OR REPLACE FUNCTION public.get_unified_sparks_feed(
  p_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_shop_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        r.audio_volume_balance

      FROM public.reels r
      JOIN public.shops s ON s.id = r.shop_id
      LEFT JOIN public.products pr ON pr.id = r.product_id
      WHERE p_shop_ids IS NULL
        OR cardinality(p_shop_ids) = 0
        OR r.shop_id = ANY(p_shop_ids)

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
        NULL::jsonb AS audio_volume_balance

      FROM public.posts p
      JOIN public.shops s ON s.id = p.shop_id
      LEFT JOIN public.products pr ON pr.id = p.product_id
      WHERE NOT p.is_ad
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
$$;
