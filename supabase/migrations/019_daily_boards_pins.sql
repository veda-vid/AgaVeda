-- Daily boards & pins for Pinterest-style saves (authenticated users)

CREATE TABLE IF NOT EXISTS public.daily_boards (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  cover_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_pins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  board_id      UUID NOT NULL REFERENCES public.daily_boards(id) ON DELETE CASCADE,
  news_id       TEXT NOT NULL,
  item_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (board_id, news_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_boards_user ON public.daily_boards(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_pins_board ON public.daily_pins(board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_pins_user_news ON public.daily_pins(user_id, news_id);

ALTER TABLE public.daily_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_boards_select_own" ON public.daily_boards;
CREATE POLICY "daily_boards_select_own"
  ON public.daily_boards FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_boards_insert_own" ON public.daily_boards;
CREATE POLICY "daily_boards_insert_own"
  ON public.daily_boards FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_boards_update_own" ON public.daily_boards;
CREATE POLICY "daily_boards_update_own"
  ON public.daily_boards FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_boards_delete_own" ON public.daily_boards;
CREATE POLICY "daily_boards_delete_own"
  ON public.daily_boards FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_pins_select_own" ON public.daily_pins;
CREATE POLICY "daily_pins_select_own"
  ON public.daily_pins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_pins_insert_own" ON public.daily_pins;
CREATE POLICY "daily_pins_insert_own"
  ON public.daily_pins FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_pins_delete_own" ON public.daily_pins;
CREATE POLICY "daily_pins_delete_own"
  ON public.daily_pins FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
