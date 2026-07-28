-- =============================================================
-- CityConnect — Stories, Reels, Cart, Following feed
-- Run in Supabase SQL Editor after schema.sql + rls.sql
-- =============================================================

-- Stories (24h expiry, Instagram-style)
CREATE TABLE IF NOT EXISTS public.stories (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url    TEXT NOT NULL,
  media_type   TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  caption      TEXT NOT NULL DEFAULT '',
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stories_shop ON public.stories(shop_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON public.stories(expires_at);

-- Reels (short video posts)
CREATE TABLE IF NOT EXISTS public.reels (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id        UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  author_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url      TEXT NOT NULL,
  caption        TEXT NOT NULL DEFAULT '',
  tags           TEXT[] NOT NULL DEFAULT '{}',
  total_likes    INT NOT NULL DEFAULT 0,
  total_comments INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reels_shop ON public.reels(shop_id);
CREATE INDEX IF NOT EXISTS idx_reels_created ON public.reels(created_at DESC);

-- Cart (buyer add-to-cart)
CREATE TABLE IF NOT EXISTS public.cart_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  quantity   INT NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_user ON public.cart_items(user_id);

-- Push token on profiles (used by notify-followers)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Following feed RPC
CREATE OR REPLACE FUNCTION feed_from_followed(p_user_id UUID)
RETURNS TABLE (
  id UUID, shop_id UUID, product_id UUID, caption TEXT,
  media_urls TEXT[], media_type TEXT, is_ad BOOLEAN,
  ad_cta_text TEXT, ad_cta_url TEXT,
  total_likes INT, total_comments INT, created_at TIMESTAMPTZ,
  shop_name TEXT, shop_logo TEXT, shop_category TEXT,
  shop_avg_rating NUMERIC, shop_is_open BOOLEAN,
  distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT p.id, p.shop_id, p.product_id, p.caption,
         p.media_urls, p.media_type, p.is_ad, p.ad_cta_text, p.ad_cta_url,
         p.total_likes, p.total_comments, p.created_at,
         s.name, s.logo_url, s.category, s.avg_rating, s.is_open,
         0::FLOAT AS distance_km
  FROM public.posts p
  JOIN public.shops s ON s.id = p.shop_id
  JOIN public.shop_followers f ON f.shop_id = p.shop_id AND f.user_id = p_user_id
  WHERE s.is_active = true
  ORDER BY p.created_at DESC;
$$;

-- Active stories for followed shops (or nearby shops)
CREATE OR REPLACE FUNCTION stories_for_user(p_user_id UUID)
RETURNS TABLE (
  id UUID, shop_id UUID, author_id UUID, media_url TEXT, media_type TEXT,
  caption TEXT, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
  shop_name TEXT, shop_logo TEXT
) LANGUAGE sql STABLE AS $$
  SELECT st.id, st.shop_id, st.author_id, st.media_url, st.media_type,
         st.caption, st.expires_at, st.created_at,
         s.name, s.logo_url
  FROM public.stories st
  JOIN public.shops s ON s.id = st.shop_id
  WHERE st.expires_at > NOW()
    AND (
      st.shop_id IN (SELECT shop_id FROM public.shop_followers WHERE user_id = p_user_id)
      OR st.author_id = p_user_id
    )
  ORDER BY st.created_at DESC;
$$;

-- Global search across shops + products
CREATE OR REPLACE FUNCTION global_search(q TEXT, user_lat FLOAT, user_lng FLOAT, radius_km FLOAT)
RETURNS TABLE (
  result_type TEXT,
  id UUID,
  title TEXT,
  subtitle TEXT,
  image_url TEXT,
  shop_id UUID,
  distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT * FROM (
    SELECT 'shop'::TEXT AS result_type,
           s.id,
           s.name AS title,
           s.category || ' · ' || s.city AS subtitle,
           s.logo_url AS image_url,
           s.id AS shop_id,
           ST_Distance(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography) / 1000 AS distance_km
    FROM public.shops s
    WHERE s.is_active = true
      AND (
        s.name ILIKE '%' || q || '%'
        OR s.category ILIKE '%' || q || '%'
        OR s.city ILIKE '%' || q || '%'
        OR s.description ILIKE '%' || q || '%'
      )
      AND ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography, radius_km * 1000)

    UNION ALL

    SELECT 'product'::TEXT,
           p.id,
           p.title,
           s.name || ' · ₹' || p.discounted_price::TEXT,
           COALESCE(p.images[1], s.logo_url),
           p.shop_id,
           ST_Distance(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography) / 1000
    FROM public.products p
    JOIN public.shops s ON s.id = p.shop_id
    WHERE p.is_available = true AND s.is_active = true
      AND (
        p.title ILIKE '%' || q || '%'
        OR p.description ILIKE '%' || q || '%'
        OR s.name ILIKE '%' || q || '%'
      )
      AND ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography, radius_km * 1000)
  ) results
  ORDER BY distance_km ASC
  LIMIT 40;
$$;

-- Notify followers when a shop posts (trigger helper — inserts notification rows)
CREATE OR REPLACE FUNCTION notify_shop_followers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT f.user_id,
         'new_product',
         'New update from ' || COALESCE((SELECT name FROM public.shops WHERE id = NEW.shop_id), 'a shop'),
         LEFT(COALESCE(NEW.caption, 'Shared a new post'), 120),
         jsonb_build_object('shop_id', NEW.shop_id, 'post_id', NEW.id)
  FROM public.shop_followers f
  WHERE f.shop_id = NEW.shop_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_notify_followers ON public.posts;
CREATE TRIGGER post_notify_followers
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION notify_shop_followers();

-- RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select_active"
  ON public.stories FOR SELECT TO authenticated
  USING (expires_at > NOW() OR author_id = auth.uid());

CREATE POLICY "stories_insert_own"
  ON public.stories FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  );

CREATE POLICY "stories_delete_own"
  ON public.stories FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "reels_select_all"
  ON public.reels FOR SELECT TO authenticated USING (true);

CREATE POLICY "reels_insert_own"
  ON public.reels FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  );

CREATE POLICY "reels_delete_own"
  ON public.reels FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "cart_select_own"
  ON public.cart_items FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cart_insert_own"
  ON public.cart_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cart_update_own"
  ON public.cart_items FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cart_delete_own"
  ON public.cart_items FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Allow authenticated clients to insert notifications for followed-shop updates
-- (also covered by SECURITY DEFINER trigger above)
CREATE POLICY "notifications_insert_system"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
