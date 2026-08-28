-- Pros: subcategories, presence tracking, in-app chat, geo RPC filters

-- ─── Service provider extensions ───────────────────────────────────────────
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS presence_status TEXT NOT NULL DEFAULT 'offline'
    CHECK (presence_status IN ('online', 'offline', 'away', 'custom')),
  ADD COLUMN IF NOT EXISTS custom_status TEXT,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_services_subcategory ON public.service_providers(subcategory)
  WHERE subcategory IS NOT NULL;

-- ─── In-app pro chat ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pro_conversations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_id, service_provider_id)
);

CREATE TABLE IF NOT EXISTS public.pro_messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id  UUID NOT NULL REFERENCES public.pro_conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body             TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_messages_conversation
  ON public.pro_messages(conversation_id, created_at DESC);

-- ─── Geo RPC with category / subcategory filters ───────────────────────────
DROP FUNCTION IF EXISTS public.services_within_radius(FLOAT, FLOAT, FLOAT);

CREATE OR REPLACE FUNCTION public.services_within_radius(
  user_lat           FLOAT,
  user_lng           FLOAT,
  radius_km          FLOAT,
  filter_category    TEXT DEFAULT NULL,
  filter_subcategory TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, profile_id UUID, business_name TEXT, category TEXT, subcategory TEXT,
  description TEXT, phone TEXT, whatsapp TEXT, area_served TEXT, city TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  experience_years INT, total_jobs INT, avg_rating NUMERIC, total_reviews INT,
  is_available BOOLEAN, is_verified BOOLEAN,
  presence_status TEXT, custom_status TEXT, last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ, distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT sv.id, sv.profile_id, sv.business_name, sv.category, sv.subcategory,
         sv.description, sv.phone, sv.whatsapp, sv.area_served, sv.city,
         sv.lat, sv.lng, sv.experience_years, sv.total_jobs, sv.avg_rating, sv.total_reviews,
         sv.is_available, sv.is_verified,
         sv.presence_status, sv.custom_status, sv.last_active_at,
         sv.created_at,
         ST_Distance(sv.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) / 1000 AS distance_km
  FROM public.service_providers sv
  WHERE sv.location IS NOT NULL
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

-- ─── RLS: chat ─────────────────────────────────────────────────────────────
ALTER TABLE public.pro_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_conv_select_participant" ON public.pro_conversations;
CREATE POLICY "pro_conv_select_participant"
  ON public.pro_conversations FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR provider_profile_id = auth.uid());

DROP POLICY IF EXISTS "pro_conv_insert_buyer" ON public.pro_conversations;
CREATE POLICY "pro_conv_insert_buyer"
  ON public.pro_conversations FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "pro_conv_update_participant" ON public.pro_conversations;
CREATE POLICY "pro_conv_update_participant"
  ON public.pro_conversations FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR provider_profile_id = auth.uid());

DROP POLICY IF EXISTS "pro_msg_select_participant" ON public.pro_messages;
CREATE POLICY "pro_msg_select_participant"
  ON public.pro_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR c.provider_profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "pro_msg_insert_participant" ON public.pro_messages;
CREATE POLICY "pro_msg_insert_participant"
  ON public.pro_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pro_conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR c.provider_profile_id = auth.uid())
    )
  );

-- Realtime (safe to ignore if publication already includes these tables)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pro_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.service_providers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
