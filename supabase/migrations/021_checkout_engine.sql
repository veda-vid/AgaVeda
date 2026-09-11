-- Checkout engine: order line items, delivery fields, transactional RPC

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS order_notes TEXT,
  ADD COLUMN IF NOT EXISTS item_subtotal NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (item_subtotal >= 0),
  ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_charge >= 0);

CREATE TABLE IF NOT EXISTS public.order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_title TEXT NOT NULL,
  unit_price    NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity      INT NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  line_total    NUMERIC(10,2) NOT NULL CHECK (line_total >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_buyer_seller_admin" ON public.order_items;
CREATE POLICY "order_items_select_buyer_seller_admin"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (
          o.buyer_id = auth.uid()
          OR o.shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
          OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
        )
    )
  );

DROP POLICY IF EXISTS "order_items_insert_checkout" ON public.order_items;
CREATE POLICY "order_items_insert_checkout"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.buyer_id = auth.uid()
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- Flat ₹49 delivery per shop (adjust in one place)
CREATE OR REPLACE FUNCTION public.process_checkout(
  p_user_id        UUID,
  p_delivery_address TEXT,
  p_contact_phone  TEXT,
  p_order_notes    TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop          RECORD;
  v_order_id      UUID;
  v_results       JSONB := '[]'::JSONB;
  v_subtotal      NUMERIC(10,2);
  v_delivery      NUMERIC(10,2) := 49;
  v_total         NUMERIC(10,2);
  v_buyer_name    TEXT;
  v_short_id      TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized checkout attempt';
  END IF;

  IF trim(COALESCE(p_delivery_address, '')) = '' THEN
    RAISE EXCEPTION 'Delivery address is required';
  END IF;

  IF trim(COALESCE(p_contact_phone, '')) = '' THEN
    RAISE EXCEPTION 'Contact phone is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cart_items WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Your cart is empty';
  END IF;

  SELECT name INTO v_buyer_name FROM public.profiles WHERE id = p_user_id;

  FOR v_shop IN
    SELECT
      ci.shop_id,
      s.name AS shop_name,
      s.owner_id,
      SUM(COALESCE(p.discounted_price, p.price, 0) * ci.quantity)::NUMERIC(10,2) AS subtotal
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    JOIN public.shops s ON s.id = ci.shop_id
    WHERE ci.user_id = p_user_id
    GROUP BY ci.shop_id, s.name, s.owner_id
  LOOP
    v_subtotal := COALESCE(v_shop.subtotal, 0);
    v_total := v_subtotal + v_delivery;

    INSERT INTO public.orders (
      buyer_id, shop_id, status, total_amount,
      item_subtotal, delivery_charge,
      delivery_address, contact_phone, order_notes
    )
    VALUES (
      p_user_id, v_shop.shop_id, 'pending', v_total,
      v_subtotal, v_delivery,
      trim(p_delivery_address), trim(p_contact_phone), trim(COALESCE(p_order_notes, ''))
    )
    RETURNING id INTO v_order_id;

    INSERT INTO public.order_items (order_id, product_id, product_title, unit_price, quantity, line_total)
    SELECT
      v_order_id,
      ci.product_id,
      p.title,
      COALESCE(p.discounted_price, p.price, 0)::NUMERIC(10,2),
      ci.quantity,
      (COALESCE(p.discounted_price, p.price, 0) * ci.quantity)::NUMERIC(10,2)
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.user_id = p_user_id AND ci.shop_id = v_shop.shop_id;

    v_short_id := upper(substr(replace(v_order_id::TEXT, '-', ''), 1, 8));

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_shop.owner_id,
      'order',
      'New order received',
      COALESCE(v_buyer_name, 'A buyer') || ' placed order #' || v_short_id || ' · ₹' || v_total::TEXT,
      jsonb_build_object('order_id', v_order_id, 'shop_id', v_shop.shop_id, 'buyer_id', p_user_id)
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'order_id', v_order_id,
      'order_ref', v_short_id,
      'shop_id', v_shop.shop_id,
      'shop_name', v_shop.shop_name,
      'owner_id', v_shop.owner_id,
      'item_subtotal', v_subtotal,
      'delivery_charge', v_delivery,
      'total_amount', v_total
    ));
  END LOOP;

  DELETE FROM public.cart_items WHERE user_id = p_user_id;

  -- Persist delivery address on buyer profile for next checkout
  UPDATE public.profiles
  SET delivery_address = trim(p_delivery_address), updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_checkout(UUID, TEXT, TEXT, TEXT) TO authenticated;
