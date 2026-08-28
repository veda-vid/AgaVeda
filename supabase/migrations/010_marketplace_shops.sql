-- Marketplace: shop presence, announcements, in-app chat, enriched geo RPC

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS presence_status TEXT NOT NULL DEFAULT 'closed'
    CHECK (presence_status IN ('open', 'closed', 'busy', 'custom')),
  ADD COLUMN IF NOT EXISTS status_message TEXT,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS accepts_messages BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.shops
SET presence_status = CASE WHEN is_open THEN 'open' ELSE 'closed' END
WHERE presence_status = 'closed';

-- Shop ↔ buyer messaging
CREATE TABLE IF NOT EXISTS public.shop_conversations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  owner_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_id, shop_id)
);

CREATE TABLE IF NOT EXISTS public.shop_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.shop_conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_messages_conversation
  ON public.shop_messages(conversation_id, created_at DESC);

DROP FUNCTION IF EXISTS public.shops_within_radius(FLOAT, FLOAT, FLOAT);

CREATE OR REPLACE FUNCTION public.shops_within_radius(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km  FLOAT
)
RETURNS TABLE (
  id UUID, owner_id UUID, name TEXT, description TEXT, category TEXT,
  logo_url TEXT, cover_url TEXT, address TEXT, city TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  phone TEXT, email TEXT, whatsapp TEXT, website TEXT, instagram TEXT,
  open_time TEXT, close_time TEXT,
  is_open BOOLEAN, is_verified BOOLEAN, is_active BOOLEAN,
  presence_status TEXT, status_message TEXT, last_active_at TIMESTAMPTZ, accepts_messages BOOLEAN,
  avg_rating NUMERIC, total_reviews INT, total_followers INT, total_products INT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT s.id, s.owner_id, s.name, s.description, s.category,
         s.logo_url, s.cover_url, s.address, s.city,
         s.lat, s.lng, s.phone, s.email, s.whatsapp, s.website, s.instagram,
         s.open_time, s.close_time,
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
  ORDER BY distance_km ASC, s.avg_rating DESC;
$$;

-- RLS: shop chat
ALTER TABLE public.shop_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_conv_select_participant" ON public.shop_conversations;
CREATE POLICY "shop_conv_select_participant"
  ON public.shop_conversations FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR owner_id = auth.uid());

DROP POLICY IF EXISTS "shop_conv_insert_buyer" ON public.shop_conversations;
CREATE POLICY "shop_conv_insert_buyer"
  ON public.shop_conversations FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "shop_conv_update_participant" ON public.shop_conversations;
CREATE POLICY "shop_conv_update_participant"
  ON public.shop_conversations FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR owner_id = auth.uid());

DROP POLICY IF EXISTS "shop_msg_select_participant" ON public.shop_messages;
CREATE POLICY "shop_msg_select_participant"
  ON public.shop_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "shop_msg_insert_participant" ON public.shop_messages;
CREATE POLICY "shop_msg_insert_participant"
  ON public.shop_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.shop_conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
