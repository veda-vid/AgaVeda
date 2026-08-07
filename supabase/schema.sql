-- =============================================================
-- CityConnect — Complete Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
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
                     'automobile','furniture','beauty','sports','books','other')),
  logo_url         TEXT,
  cover_url        TEXT,
  address          TEXT NOT NULL DEFAULT '',
  city             TEXT NOT NULL,
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  location         GEOGRAPHY(POINT, 4326),  -- PostGIS point for fast geo queries
  phone            TEXT NOT NULL,
  whatsapp         TEXT,
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
