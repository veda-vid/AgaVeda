-- =============================================================
-- CityConnect — Complete Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for text search

-- =============================================================
-- PROFILES
-- =============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT '',
  phone           TEXT UNIQUE,
  email           TEXT,
  avatar_url      TEXT,
  bio             TEXT NOT NULL DEFAULT 'Hey, I am new in the market. with hi smiles',
  role            TEXT NOT NULL DEFAULT 'buyer'
                    CHECK (role IN ('buyer','seller','service_provider','super_admin')),
  city            TEXT NOT NULL DEFAULT '',
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  radius_km       INT NOT NULL DEFAULT 5 CHECK (radius_km BETWEEN 1 AND 100),
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  is_suspended    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- SHOPS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.shops (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  category         TEXT NOT NULL CHECK (category IN (
                     'grocery','electronics','fashion','food','pharmacy',
                     'automobile','furniture','beauty','sports','books','toys',
                     'pet_supplies','home_decor','jewelry','watches','footwear',
                     'baby_kids','stationery','gifts','florists','hardware',
                     'kitchenware','mobile_accessories','computer_accessories',
                     'appliances','bakery','cafe','restaurant','meat_seafood',
                     'dairy','organic','liquor','eyewear','luggage','music',
                     'gaming','art_crafts','fitness','medical_supplies',
                     'industrial','gardening','cleaning_supplies','fabrics',
                     'tailoring','salon','spa','bicycle','travel','religious','other')),
  logo_url         TEXT,
  cover_url        TEXT,
  address          TEXT NOT NULL DEFAULT '',
  city             TEXT NOT NULL,
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  location         GEOGRAPHY(POINT, 4326),  -- PostGIS point for fast geo queries
  phone            TEXT NOT NULL,
  email            TEXT NOT NULL DEFAULT '' CHECK (char_length(trim(email)) > 0),
  whatsapp         TEXT,
  website          TEXT,
  instagram        TEXT,
  open_time        TEXT NOT NULL DEFAULT '' CHECK (char_length(trim(open_time)) > 0),
  close_time       TEXT NOT NULL DEFAULT '' CHECK (char_length(trim(close_time)) > 0),
  is_open          BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  avg_rating       NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews    INT NOT NULL DEFAULT 0,
  total_followers  INT NOT NULL DEFAULT 0,
  total_products   INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-set PostGIS location from lat/lng
CREATE OR REPLACE FUNCTION set_shop_location()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shop_location_trigger
  BEFORE INSERT OR UPDATE OF lat, lng ON public.shops
  FOR EACH ROW EXECUTE FUNCTION set_shop_location();

CREATE INDEX idx_shops_location ON public.shops USING GIST(location);
CREATE INDEX idx_shops_city ON public.shops(city);
CREATE INDEX idx_shops_category ON public.shops(category);
CREATE INDEX idx_shops_active ON public.shops(is_active);

-- =============================================================
-- PRODUCTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id          UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  discount_pct     INT NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  discounted_price NUMERIC(10,2) GENERATED ALWAYS AS (price * (1 - discount_pct::numeric/100)) STORED,
  images           TEXT[] NOT NULL DEFAULT '{}',
  category         TEXT NOT NULL,
  is_available     BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured      BOOLEAN NOT NULL DEFAULT FALSE,
  total_likes      INT NOT NULL DEFAULT 0,
  total_comments   INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_shop ON public.products(shop_id);
CREATE INDEX idx_products_discount ON public.products(discount_pct DESC) WHERE discount_pct > 0;

-- =============================================================
-- POSTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id        UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id     UUID REFERENCES public.products(id) ON DELETE SET NULL,
  caption        TEXT NOT NULL DEFAULT '',
  media_urls     TEXT[] NOT NULL DEFAULT '{}',
  media_type     TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_ad          BOOLEAN NOT NULL DEFAULT FALSE,
  ad_cta_text    TEXT,
  ad_cta_url     TEXT,
  total_likes    INT NOT NULL DEFAULT 0,
  total_comments INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_shop ON public.posts(shop_id);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);

-- =============================================================
-- POST LIKES
-- =============================================================
CREATE TABLE IF NOT EXISTS public.post_likes (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Auto-update post like count
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET total_likes = total_likes + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET total_likes = GREATEST(0, total_likes - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER post_like_count_trigger
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_like_count();

-- =============================================================
-- SAVED POSTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.saved_posts (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- =============================================================
-- ORDERS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','completed','cancelled','failed')),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  placed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_shop_completed ON public.orders(shop_id, completed_at DESC);
CREATE INDEX idx_orders_shop_status ON public.orders(shop_id, status);
CREATE INDEX idx_orders_buyer_completed ON public.orders(buyer_id, completed_at DESC);

-- =============================================================
-- SELLER COMPETITIVE SCORES
-- =============================================================
CREATE TABLE IF NOT EXISTS public.seller_competitive_scores (
  seller_id                    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_id                      UUID NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  city                         TEXT NOT NULL,
  category                     TEXT NOT NULL,
  review_score_raw             NUMERIC(10,2) NOT NULL DEFAULT 0,
  review_points                NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (review_points BETWEEN 0 AND 40),
  monthly_successful_orders    INT NOT NULL DEFAULT 0 CHECK (monthly_successful_orders >= 0),
  order_points                 NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (order_points BETWEEN 0 AND 40),
  repeat_buyer_pct             NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (repeat_buyer_pct BETWEEN 0 AND 100),
  retention_points             NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (retention_points BETWEEN 0 AND 20),
  composite_competitive_score  NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (composite_competitive_score BETWEEN 0 AND 100),
  category_rank                INT NOT NULL DEFAULT 1 CHECK (category_rank >= 1),
  category_population          INT NOT NULL DEFAULT 1 CHECK (category_population >= 1),
  seller_tier                  TEXT NOT NULL DEFAULT 'Tier 1'
                                 CHECK (seller_tier IN ('Tier 1','Tier 2','Tier 3','Tier 4')),
  calculated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seller_scores_city_category_rank
  ON public.seller_competitive_scores(city, category, category_rank, composite_competitive_score DESC);

-- =============================================================
-- COMMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text       TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON public.comments(post_id);

CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET total_comments = total_comments + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET total_comments = GREATEST(0, total_comments - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER post_comment_count_trigger
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

-- =============================================================
-- SELLER COMPETITIVE SCORING
-- =============================================================
CREATE OR REPLACE FUNCTION public.refresh_seller_competitive_scores()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  WITH seller_inputs AS (
    SELECT
      sh.owner_id AS seller_id,
      sh.id AS shop_id,
      sh.city,
      sh.category,
      (COALESCE(sh.avg_rating, 0) * COALESCE(sh.total_reviews, 0))::NUMERIC(10,2) AS review_score_raw,
      COALESCE((
        SELECT COUNT(*)
        FROM public.orders o
        WHERE o.shop_id = sh.id
          AND o.status = 'completed'
          AND COALESCE(o.completed_at, o.placed_at) >= NOW() - INTERVAL '30 days'
      ), 0)::INT AS monthly_successful_orders,
      COALESCE((
        WITH buyer_window AS (
          SELECT o.buyer_id, COUNT(*) AS order_count
          FROM public.orders o
          WHERE o.shop_id = sh.id
            AND o.status = 'completed'
            AND COALESCE(o.completed_at, o.placed_at) >= NOW() - INTERVAL '90 days'
          GROUP BY o.buyer_id
        )
        SELECT
          CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(
              (
                (COUNT(*) FILTER (WHERE order_count > 1))::NUMERIC
                / COUNT(*)::NUMERIC
              ) * 100,
              2
            )
          END
        FROM buyer_window
      ), 0)::NUMERIC(5,2) AS repeat_buyer_pct
    FROM public.shops sh
    JOIN public.profiles p ON p.id = sh.owner_id
    WHERE p.role = 'seller'
      AND sh.is_active = TRUE
  ),
  normalized AS (
    SELECT
      seller_inputs.*,
      CASE
        WHEN MAX(review_score_raw) OVER (PARTITION BY category) > 0
          THEN ROUND((review_score_raw / MAX(review_score_raw) OVER (PARTITION BY category)) * 40, 2)
        ELSE 0
      END AS review_points,
      CASE
        WHEN MAX(monthly_successful_orders) OVER (PARTITION BY category) > 0
          THEN ROUND(
            (
              monthly_successful_orders::NUMERIC
              / (MAX(monthly_successful_orders) OVER (PARTITION BY category))::NUMERIC
            ) * 40,
            2
          )
        ELSE 0
      END AS order_points,
      CASE
        WHEN MAX(repeat_buyer_pct) OVER (PARTITION BY category) > 0
          THEN ROUND(
            (repeat_buyer_pct / (MAX(repeat_buyer_pct) OVER (PARTITION BY category))) * 20,
            2
          )
        ELSE 0
      END AS retention_points
    FROM seller_inputs
  ),
  ranked AS (
    SELECT
      normalized.*,
      ROUND(LEAST(100, review_points + order_points + retention_points), 2) AS composite_competitive_score,
      ROW_NUMBER() OVER (
        PARTITION BY city, category
        ORDER BY
          (review_points + order_points + retention_points) DESC,
          review_score_raw DESC,
          monthly_successful_orders DESC,
          repeat_buyer_pct DESC,
          shop_id
      ) AS category_rank,
      COUNT(*) OVER (PARTITION BY city, category) AS category_population
    FROM normalized
  )
  INSERT INTO public.seller_competitive_scores (
    seller_id,
    shop_id,
    city,
    category,
    review_score_raw,
    review_points,
    monthly_successful_orders,
    order_points,
    repeat_buyer_pct,
    retention_points,
    composite_competitive_score,
    category_rank,
    category_population,
    seller_tier,
    calculated_at
  )
  SELECT
    seller_id,
    shop_id,
    city,
    category,
    review_score_raw,
    review_points,
    monthly_successful_orders,
    order_points,
    repeat_buyer_pct,
    retention_points,
    composite_competitive_score,
    category_rank,
    category_population,
    CASE
      WHEN composite_competitive_score <= 25 THEN 'Tier 1'
      WHEN composite_competitive_score <= 50 THEN 'Tier 2'
      WHEN composite_competitive_score <= 75 THEN 'Tier 3'
      ELSE 'Tier 4'
    END AS seller_tier,
    NOW()
  FROM ranked
  ON CONFLICT (seller_id) DO UPDATE
  SET
    shop_id = EXCLUDED.shop_id,
    city = EXCLUDED.city,
    category = EXCLUDED.category,
    review_score_raw = EXCLUDED.review_score_raw,
    review_points = EXCLUDED.review_points,
    monthly_successful_orders = EXCLUDED.monthly_successful_orders,
    order_points = EXCLUDED.order_points,
    repeat_buyer_pct = EXCLUDED.repeat_buyer_pct,
    retention_points = EXCLUDED.retention_points,
    composite_competitive_score = EXCLUDED.composite_competitive_score,
    category_rank = EXCLUDED.category_rank,
    category_population = EXCLUDED.category_population,
    seller_tier = EXCLUDED.seller_tier,
    calculated_at = EXCLUDED.calculated_at;

  DELETE FROM public.seller_competitive_scores sc
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.shops sh
    JOIN public.profiles p ON p.id = sh.owner_id
    WHERE sh.owner_id = sc.seller_id
      AND sh.id = sc.shop_id
      AND p.role = 'seller'
      AND sh.is_active = TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_seller_competitive_profile()
RETURNS TABLE (
  seller_id UUID,
  shop_id UUID,
  city TEXT,
  category TEXT,
  review_score_raw NUMERIC,
  review_points NUMERIC,
  monthly_successful_orders INT,
  order_points NUMERIC,
  repeat_buyer_pct NUMERIC,
  retention_points NUMERIC,
  composite_competitive_score NUMERIC,
  category_rank INT,
  category_population INT,
  seller_tier TEXT,
  calculated_at TIMESTAMPTZ
)
LANGUAGE sql
SET search_path = public
AS $$
  SELECT
    seller_id,
    shop_id,
    city,
    category,
    review_score_raw,
    review_points,
    monthly_successful_orders,
    order_points,
    repeat_buyer_pct,
    retention_points,
    composite_competitive_score,
    category_rank,
    category_population,
    seller_tier,
    calculated_at
  FROM public.seller_competitive_scores
  WHERE seller_id = auth.uid()
  LIMIT 1;
$$;

-- =============================================================
-- SHOP FOLLOWERS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.shop_followers (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, shop_id)
);

CREATE OR REPLACE FUNCTION update_shop_follower_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.shops SET total_followers = total_followers + 1 WHERE id = NEW.shop_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.shops SET total_followers = GREATEST(0, total_followers - 1) WHERE id = OLD.shop_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER shop_follower_count_trigger
  AFTER INSERT OR DELETE ON public.shop_followers
  FOR EACH ROW EXECUTE FUNCTION update_shop_follower_count();

-- =============================================================
-- SERVICE PROVIDERS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.service_providers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name    TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN (
                     'plumber','electrician','ac_technician','painter','cleaning',
                     'gardening','security','carpenter','pest_control','other')),
  description      TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL,
  whatsapp         TEXT,
  area_served      TEXT NOT NULL DEFAULT '',
  city             TEXT NOT NULL,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  location         GEOGRAPHY(POINT, 4326),
  experience_years INT NOT NULL DEFAULT 0,
  total_jobs       INT NOT NULL DEFAULT 0,
  avg_rating       NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews    INT NOT NULL DEFAULT 0,
  is_available     BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_service_location()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER service_location_trigger
  BEFORE INSERT OR UPDATE OF lat, lng ON public.service_providers
  FOR EACH ROW EXECUTE FUNCTION set_service_location();

CREATE INDEX idx_services_location ON public.service_providers USING GIST(location);

-- =============================================================
-- REVIEWS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reviewer_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id    UUID NOT NULL,
  target_type  TEXT NOT NULL CHECK (target_type IN ('shop','service_provider')),
  rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reviewer_id, target_id, target_type)  -- one review per user per target
);

-- Auto-update avg_rating on shops / services
CREATE OR REPLACE FUNCTION update_target_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  new_avg  NUMERIC(3,2);
  new_count INT;
BEGIN
  SELECT AVG(rating)::NUMERIC(3,2), COUNT(*) INTO new_avg, new_count
  FROM public.reviews WHERE target_id = COALESCE(NEW.target_id, OLD.target_id)
    AND target_type = COALESCE(NEW.target_type, OLD.target_type);

  IF COALESCE(NEW.target_type, OLD.target_type) = 'shop' THEN
    UPDATE public.shops SET avg_rating = COALESCE(new_avg,0), total_reviews = new_count
    WHERE id = COALESCE(NEW.target_id, OLD.target_id);
  ELSIF COALESCE(NEW.target_type, OLD.target_type) = 'service_provider' THEN
    UPDATE public.service_providers SET avg_rating = COALESCE(new_avg,0), total_reviews = new_count
    WHERE id = COALESCE(NEW.target_id, OLD.target_id);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER review_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_target_rating();

-- =============================================================
-- ADS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.ads (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url   TEXT NOT NULL,
  cta_text    TEXT NOT NULL DEFAULT 'Learn More',
  cta_url     TEXT NOT NULL DEFAULT '',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  priority    INT NOT NULL DEFAULT 1,
  impressions INT NOT NULL DEFAULT 0,
  clicks      INT NOT NULL DEFAULT 0,
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at     TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- NOTIFICATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);

-- =============================================================
-- CITY NEWS (super-admin managed “city newspaper”)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.city_news (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city           TEXT NOT NULL,
  category       TEXT NOT NULL CHECK (category IN ('event','rates','weather','alerts','general')),
  title          TEXT NOT NULL,
  body           TEXT NOT NULL DEFAULT '',
  image_url      TEXT,
  source_url     TEXT,
  is_published   BOOLEAN NOT NULL DEFAULT FALSE,
  author_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_likes    INT NOT NULL DEFAULT 0,
  total_comments INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_city_news_city_published ON public.city_news(city, is_published, created_at DESC);
CREATE INDEX idx_city_news_created ON public.city_news(created_at DESC);

CREATE TABLE IF NOT EXISTS public.city_news_likes (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  news_id    UUID NOT NULL REFERENCES public.city_news(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, news_id)
);

CREATE TABLE IF NOT EXISTS public.city_news_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  news_id    UUID NOT NULL REFERENCES public.city_news(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text       TEXT NOT NULL CHECK (char_length(trim(text)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_city_news_likes_news ON public.city_news_likes(news_id);
CREATE INDEX idx_city_news_comments_news ON public.city_news_comments(news_id, created_at);

CREATE OR REPLACE FUNCTION increment_city_news_like_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.city_news SET total_likes = total_likes + 1 WHERE id = NEW.news_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.city_news SET total_likes = GREATEST(0, total_likes - 1) WHERE id = OLD.news_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS city_news_like_count_trigger ON public.city_news_likes;
CREATE TRIGGER city_news_like_count_trigger
  AFTER INSERT OR DELETE ON public.city_news_likes
  FOR EACH ROW EXECUTE FUNCTION increment_city_news_like_count();

CREATE OR REPLACE FUNCTION increment_city_news_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.city_news SET total_comments = total_comments + 1 WHERE id = NEW.news_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.city_news SET total_comments = GREATEST(0, total_comments - 1) WHERE id = OLD.news_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS city_news_comment_count_trigger ON public.city_news_comments;
CREATE TRIGGER city_news_comment_count_trigger
  AFTER INSERT OR DELETE ON public.city_news_comments
  FOR EACH ROW EXECUTE FUNCTION increment_city_news_comment_count();

-- =============================================================
-- GEOGRAPHIC RPC FUNCTIONS
-- =============================================================

-- Feed posts within radius
CREATE OR REPLACE FUNCTION feed_within_radius(user_lat FLOAT, user_lng FLOAT, radius_km FLOAT)
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
         ST_Distance(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography) / 1000 AS distance_km
  FROM public.posts p
  JOIN public.shops s ON s.id = p.shop_id
  WHERE s.is_active = true
    AND ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography, radius_km * 1000)
  ORDER BY p.created_at DESC;
$$;

-- Shops within radius
CREATE OR REPLACE FUNCTION shops_within_radius(user_lat FLOAT, user_lng FLOAT, radius_km FLOAT)
RETURNS TABLE (
  id UUID, owner_id UUID, name TEXT, description TEXT, category TEXT,
  logo_url TEXT, cover_url TEXT, address TEXT, city TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  phone TEXT, whatsapp TEXT, is_open BOOLEAN, is_verified BOOLEAN, is_active BOOLEAN,
  avg_rating NUMERIC, total_reviews INT, total_followers INT, total_products INT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT s.id, s.owner_id, s.name, s.description, s.category,
         s.logo_url, s.cover_url, s.address, s.city,
         s.lat, s.lng, s.phone, s.whatsapp, s.is_open, s.is_verified, s.is_active,
         s.avg_rating, s.total_reviews, s.total_followers, s.total_products,
         s.created_at, s.updated_at,
         ST_Distance(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography) / 1000 AS distance_km
  FROM public.shops s
  WHERE s.is_active = true
    AND ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography, radius_km * 1000)
  ORDER BY distance_km ASC;
$$;

-- Discounted products nearby
CREATE OR REPLACE FUNCTION discounted_products_nearby(user_lat FLOAT, user_lng FLOAT, radius_km FLOAT)
RETURNS TABLE (
  id UUID, shop_id UUID, title TEXT, description TEXT,
  price NUMERIC, discount_pct INT, discounted_price NUMERIC,
  images TEXT[], category TEXT, is_available BOOLEAN,
  total_likes INT, total_comments INT, created_at TIMESTAMPTZ,
  shop_name TEXT, shop_city TEXT, distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT p.id, p.shop_id, p.title, p.description,
         p.price, p.discount_pct, p.discounted_price,
         p.images, p.category, p.is_available,
         p.total_likes, p.total_comments, p.created_at,
         s.name, s.city,
         ST_Distance(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography) / 1000 AS distance_km
  FROM public.products p
  JOIN public.shops s ON s.id = p.shop_id
  WHERE p.discount_pct > 0 AND p.is_available = true AND s.is_active = true
    AND ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography, radius_km * 1000)
  ORDER BY p.discount_pct DESC;
$$;

-- Services within radius
CREATE OR REPLACE FUNCTION services_within_radius(user_lat FLOAT, user_lng FLOAT, radius_km FLOAT)
RETURNS TABLE (
  id UUID, profile_id UUID, business_name TEXT, category TEXT, description TEXT,
  phone TEXT, whatsapp TEXT, area_served TEXT, city TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  experience_years INT, total_jobs INT, avg_rating NUMERIC, total_reviews INT,
  is_available BOOLEAN, is_verified BOOLEAN, created_at TIMESTAMPTZ, distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT sv.id, sv.profile_id, sv.business_name, sv.category, sv.description,
         sv.phone, sv.whatsapp, sv.area_served, sv.city, sv.lat, sv.lng,
         sv.experience_years, sv.total_jobs, sv.avg_rating, sv.total_reviews,
         sv.is_available, sv.is_verified, sv.created_at,
         ST_Distance(sv.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography) / 1000 AS distance_km
  FROM public.service_providers sv
  WHERE sv.location IS NOT NULL
    AND ST_DWithin(sv.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat),4326)::geography, radius_km * 1000)
  ORDER BY distance_km ASC, sv.avg_rating DESC;
$$;

-- Ad impression / click helpers
CREATE OR REPLACE FUNCTION increment_ad_impressions(ad_id UUID)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE public.ads SET impressions = impressions + 1 WHERE id = ad_id;
$$;

CREATE OR REPLACE FUNCTION increment_ad_clicks(ad_id UUID)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE public.ads SET clicks = clicks + 1 WHERE id = ad_id;
$$;

SELECT public.refresh_seller_competitive_scores();

DO $cron_job$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-seller-competitive-scores') THEN
    PERFORM cron.unschedule('refresh-seller-competitive-scores');
  END IF;
  PERFORM cron.schedule(
    'refresh-seller-competitive-scores',
    '0 2 * * *',
    'SELECT public.refresh_seller_competitive_scores();'
  );
END
$cron_job$;
