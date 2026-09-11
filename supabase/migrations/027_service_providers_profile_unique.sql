-- Deduplicate service_providers (one row per profile) and enforce uniqueness

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY profile_id ORDER BY created_at DESC, id DESC) AS rn
  FROM public.service_providers
)
DELETE FROM public.service_providers sp
USING ranked r
WHERE sp.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_providers_profile_id_unique
  ON public.service_providers(profile_id);
