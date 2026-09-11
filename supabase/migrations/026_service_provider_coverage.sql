-- Service provider coverage radius for skill modal + buyer discovery

ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS coverage_radius_km INT NOT NULL DEFAULT 5
    CHECK (coverage_radius_km IN (2, 5, 10, 25));
