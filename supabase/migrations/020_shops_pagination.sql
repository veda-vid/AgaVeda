-- Marketplace pagination: limit/offset + optional category filter on shops_within_radius

DROP FUNCTION IF EXISTS public.shops_within_radius(FLOAT, FLOAT, FLOAT);

CREATE OR REPLACE FUNCTION public.shops_within_radius(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, owner_id UUID, name TEXT, description TEXT, category TEXT,
  logo_url TEXT, cover_url TEXT, address TEXT, city TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  phone TEXT, email TEXT, whatsapp TEXT, website TEXT, instagram TEXT,
  open_time TEXT, close_time TEXT, operating_hours JSONB,
  is_open BOOLEAN, is_verified BOOLEAN, is_active BOOLEAN,
  presence_status TEXT, status_message TEXT, last_active_at TIMESTAMPTZ, accepts_messages BOOLEAN,
  avg_rating NUMERIC, total_reviews INT, total_followers INT, total_products INT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT s.id, s.owner_id, s.name, s.description, s.category,
         s.logo_url, s.cover_url, s.address, s.city,
         s.lat, s.lng, s.phone, s.email, s.whatsapp, s.website, s.instagram,
         s.open_time, s.close_time, s.operating_hours,
         s.is_open, s.is_verified, s.is_active,
         s.presence_status, s.status_message, s.last_active_at, s.accepts_messages,
         s.avg_rating, s.total_reviews, s.total_followers, s.total_products,
         s.created_at, s.updated_at,
         ST_Distance(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) / 1000 AS distance_km
  FROM public.shops s
  WHERE s.is_active = true
    AND ST_DWithin(
      s.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
    AND (p_category IS NULL OR p_category = '' OR s.category = p_category)
  ORDER BY distance_km ASC, s.avg_rating DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
