-- Update feed functions to include repost data (is_reposted, total_reposts)

-- Update feed_within_radius to include repost data and accept user_id parameter
DROP FUNCTION IF EXISTS feed_within_radius(FLOAT, FLOAT, FLOAT);

CREATE OR REPLACE FUNCTION feed_within_radius(user_lat FLOAT, user_lng FLOAT, radius_km FLOAT, p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID, shop_id UUID, product_id UUID, caption TEXT,
  media_urls TEXT[], media_type TEXT, is_ad BOOLEAN,
  ad_cta_text TEXT, ad_cta_url TEXT,
  total_likes INT, total_comments INT, total_reposts INT,
  is_liked BOOLEAN, is_saved BOOLEAN, is_reposted BOOLEAN,
  created_at TIMESTAMPTZ,
  shop_name TEXT, shop_logo TEXT, shop_category TEXT,
  shop_avg_rating NUMERIC, shop_is_open BOOLEAN,
  distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT 
    p.id, p.shop_id, p.product_id, p.caption,
    p.media_urls, p.media_type, p.is_ad, p.ad_cta_text, p.ad_cta_url,
    p.total_likes, p.total_comments,
    COALESCE((SELECT COUNT(*)::INT FROM public.reposts WHERE post_id = p.id), 0) AS total_reposts,
    COALESCE((SELECT EXISTS(SELECT 1 FROM public.post_likes WHERE post_id = p.id AND user_id = p_user_id)), false) AS is_liked,
    COALESCE((SELECT EXISTS(SELECT 1 FROM public.saved_posts WHERE post_id = p.id AND user_id = p_user_id)), false) AS is_saved,
    COALESCE((SELECT EXISTS(SELECT 1 FROM public.reposts WHERE post_id = p.id AND user_id = p_user_id)), false) AS is_reposted,
    p.created_at,
    s.name, s.logo_url, s.category, s.avg_rating, s.is_open,
    ST_Distance(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography) / 1000 AS distance_km
  FROM public.posts p
  JOIN public.shops s ON s.id = p.shop_id
  WHERE s.is_active = true
    AND ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography, radius_km * 1000)
  ORDER BY p.created_at DESC;
$$;

-- Update feed_from_followed to include repost data
DROP FUNCTION IF EXISTS feed_from_followed(UUID);

CREATE OR REPLACE FUNCTION feed_from_followed(p_user_id UUID)
RETURNS TABLE (
  id UUID, shop_id UUID, product_id UUID, caption TEXT,
  media_urls TEXT[], media_type TEXT, is_ad BOOLEAN,
  ad_cta_text TEXT, ad_cta_url TEXT,
  total_likes INT, total_comments INT, total_reposts INT,
  is_liked BOOLEAN, is_saved BOOLEAN, is_reposted BOOLEAN,
  created_at TIMESTAMPTZ,
  shop_name TEXT, shop_logo TEXT, shop_category TEXT,
  shop_avg_rating NUMERIC, shop_is_open BOOLEAN,
  distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT 
    p.id, p.shop_id, p.product_id, p.caption,
    p.media_urls, p.media_type, p.is_ad, p.ad_cta_text, p.ad_cta_url,
    p.total_likes, p.total_comments,
    COALESCE((SELECT COUNT(*)::INT FROM public.reposts WHERE post_id = p.id), 0) AS total_reposts,
    COALESCE((SELECT EXISTS(SELECT 1 FROM public.post_likes WHERE post_id = p.id AND user_id = p_user_id)), false) AS is_liked,
    COALESCE((SELECT EXISTS(SELECT 1 FROM public.saved_posts WHERE post_id = p.id AND user_id = p_user_id)), false) AS is_saved,
    COALESCE((SELECT EXISTS(SELECT 1 FROM public.reposts WHERE post_id = p.id AND user_id = p_user_id)), false) AS is_reposted,
    p.created_at,
    s.name, s.logo_url, s.category, s.avg_rating, s.is_open,
    0::FLOAT AS distance_km
  FROM public.posts p
  JOIN public.shops s ON s.id = p.shop_id
  JOIN public.shop_followers f ON f.shop_id = p.shop_id AND f.user_id = p_user_id
  WHERE s.is_active = true
  ORDER BY p.created_at DESC;
$$;
