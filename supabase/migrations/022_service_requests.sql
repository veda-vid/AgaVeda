-- Service booking / callback requests from buyers to pros

CREATE TABLE IF NOT EXISTS public.service_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  urgency             TEXT NOT NULL DEFAULT 'today'
                        CHECK (urgency IN ('emergency', 'today', 'scheduled')),
  scheduled_date      DATE,
  subcategory         TEXT,
  description         TEXT NOT NULL CHECK (char_length(trim(description)) >= 8),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_provider
  ON public.service_requests(service_provider_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_buyer
  ON public.service_requests(buyer_id, created_at DESC);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_req_select_participant" ON public.service_requests;
CREATE POLICY "service_req_select_participant"
  ON public.service_requests FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR service_provider_id IN (
      SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

DROP POLICY IF EXISTS "service_req_insert_buyer" ON public.service_requests;
CREATE POLICY "service_req_insert_buyer"
  ON public.service_requests FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "service_req_update_participant" ON public.service_requests;
CREATE POLICY "service_req_update_participant"
  ON public.service_requests FOR UPDATE TO authenticated
  USING (
    buyer_id = auth.uid()
    OR service_provider_id IN (
      SELECT id FROM public.service_providers WHERE profile_id = auth.uid()
    )
  );
