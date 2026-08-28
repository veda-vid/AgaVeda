-- Seller lead & enquiry management

CREATE TABLE IF NOT EXISTS public.shop_enquiries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  buyer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES public.products(id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('chat', 'quote', 'callback')),
  message      TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
  contacted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_enquiries_shop_created
  ON public.shop_enquiries(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_enquiries_buyer
  ON public.shop_enquiries(buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_enquiries_status
  ON public.shop_enquiries(shop_id, status);

CREATE OR REPLACE FUNCTION public.touch_shop_enquiry_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status IN ('contacted', 'converted') AND OLD.status = 'new' AND NEW.contacted_at IS NULL THEN
    NEW.contacted_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_enquiries_updated_at ON public.shop_enquiries;
CREATE TRIGGER shop_enquiries_updated_at
  BEFORE UPDATE ON public.shop_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.touch_shop_enquiry_updated_at();

-- Aggregate stats for seller dashboard
CREATE OR REPLACE FUNCTION public.get_my_seller_enquiry_stats()
RETURNS TABLE (
  total_leads INT,
  new_leads INT,
  conversion_rate NUMERIC,
  avg_response_minutes NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH my_shop AS (
    SELECT id FROM public.shops WHERE owner_id = auth.uid() LIMIT 1
  ),
  leads AS (
    SELECT e.*
    FROM public.shop_enquiries e
    JOIN my_shop s ON s.id = e.shop_id
  )
  SELECT
    COUNT(*)::INT AS total_leads,
    COUNT(*) FILTER (WHERE status = 'new')::INT AS new_leads,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE status = 'converted')::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
    END AS conversion_rate,
    COALESCE(
      ROUND(AVG(EXTRACT(EPOCH FROM (contacted_at - created_at)) / 60.0)
        FILTER (WHERE contacted_at IS NOT NULL), 0),
      0
    ) AS avg_response_minutes
  FROM leads;
$$;

-- RLS
ALTER TABLE public.shop_enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_enquiries_select_participant" ON public.shop_enquiries;
CREATE POLICY "shop_enquiries_select_participant"
  ON public.shop_enquiries FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.shops sh
      WHERE sh.id = shop_id AND sh.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "shop_enquiries_insert_buyer" ON public.shop_enquiries;
CREATE POLICY "shop_enquiries_insert_buyer"
  ON public.shop_enquiries FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "shop_enquiries_update_owner" ON public.shop_enquiries;
CREATE POLICY "shop_enquiries_update_owner"
  ON public.shop_enquiries FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops sh
      WHERE sh.id = shop_id AND sh.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops sh
      WHERE sh.id = shop_id AND sh.owner_id = auth.uid()
    )
  );

-- Allow shop owners to start conversations when responding to leads
DROP POLICY IF EXISTS "shop_conv_insert_owner" ON public.shop_conversations;
CREATE POLICY "shop_conv_insert_owner"
  ON public.shop_conversations FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.shops sh
      WHERE sh.id = shop_id AND sh.owner_id = auth.uid()
    )
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_enquiries;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_my_seller_enquiry_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_seller_enquiry_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_seller_enquiry_stats() TO authenticated;
