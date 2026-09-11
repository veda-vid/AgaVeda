-- Extend services_within_radius to return listing discovery fields for Pros tab cards.

DROP FUNCTION IF EXISTS public.services_within_radius(FLOAT, FLOAT, FLOAT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.services_within_radius(
  user_lat           FLOAT,
  user_lng           FLOAT,
  radius_km          FLOAT,
  filter_category    TEXT DEFAULT NULL,
  filter_subcategory TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  profile_id UUID,
  business_name TEXT,
  category TEXT,
  subcategory TEXT,
  description TEXT,
  base_rate_label TEXT,
  experience_years INT,
  portfolio_photos TEXT[],
  phone TEXT,
  whatsapp TEXT,
  area_served TEXT,
  city TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  coverage_radius_km INT,
  total_jobs INT,
  avg_rating NUMERIC,
  total_reviews INT,
  is_available BOOLEAN,
  is_verified BOOLEAN,
  presence_status TEXT,
  custom_status TEXT,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    sv.id,
    sv.profile_id,
    sv.business_name,
    sv.category,
    sv.subcategory,
    sv.description,
    sv.base_rate_label,
    sv.experience_years,
    sv.portfolio_photos,
    sv.phone,
    sv.whatsapp,
    sv.area_served,
    sv.city,
    sv.lat,
    sv.lng,
    sv.coverage_radius_km,
    sv.total_jobs,
    sv.avg_rating,
    sv.total_reviews,
    sv.is_available,
    sv.is_verified,
    sv.presence_status,
    sv.custom_status,
    sv.last_active_at,
    sv.created_at,
    ST_Distance(
      sv.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000 AS distance_km
  FROM public.service_providers sv
  WHERE sv.location IS NOT NULL
    AND sv.lat IS NOT NULL
    AND sv.lng IS NOT NULL
    AND ST_DWithin(
      sv.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
    AND (
      filter_category IS NULL
      OR filter_category = 'all'
      OR sv.category = filter_category
    )
    AND (
      filter_subcategory IS NULL
      OR (sv.category = 'other' AND sv.subcategory = filter_subcategory)
    )
  ORDER BY distance_km ASC, sv.avg_rating DESC;
$$;
