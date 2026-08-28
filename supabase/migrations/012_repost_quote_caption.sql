-- Add optional quote caption for "Repost with Quote"
ALTER TABLE public.reposts
  ADD COLUMN IF NOT EXISTS quote_caption TEXT;

CREATE INDEX IF NOT EXISTS idx_reposts_quote
  ON public.reposts (created_at DESC)
  WHERE quote_caption IS NOT NULL;
