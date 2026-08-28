-- Unify Spark reposts into the main reposts table (content_type: post | spark)

ALTER TABLE public.reposts
  ADD COLUMN IF NOT EXISTS spark_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'post'
    CHECK (content_type IN ('post', 'spark'));

ALTER TABLE public.reposts
  ALTER COLUMN post_id DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.reposts
    ADD CONSTRAINT reposts_content_target_check
    CHECK (
      (content_type = 'post' AND post_id IS NOT NULL)
      OR (content_type = 'spark' AND spark_id IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reposts_user_spark_unique
  ON public.reposts(user_id, spark_id)
  WHERE spark_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reposts_user_content
  ON public.reposts(user_id, content_type, created_at DESC);

-- Backfill legacy spark_reposts rows when that table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spark_reposts'
  ) THEN
    INSERT INTO public.reposts (user_id, spark_id, shop_id, content_type, created_at)
    SELECT sr.user_id, sr.spark_id, r.shop_id, 'spark', sr.created_at
    FROM public.spark_reposts sr
    JOIN public.reels r ON r.id = sr.spark_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.reposts rp
      WHERE rp.user_id = sr.user_id AND rp.spark_id = sr.spark_id
    );
  END IF;
END $$;
