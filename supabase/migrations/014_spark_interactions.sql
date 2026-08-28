-- Spark (reel) interaction tables: likes, reposts, comments

CREATE TABLE IF NOT EXISTS public.spark_likes (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  spark_id   UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, spark_id)
);

CREATE TABLE IF NOT EXISTS public.spark_reposts (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  spark_id   UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, spark_id)
);

CREATE TABLE IF NOT EXISTS public.spark_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spark_id   UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spark_likes_spark ON public.spark_likes(spark_id);
CREATE INDEX IF NOT EXISTS idx_spark_reposts_spark ON public.spark_reposts(spark_id);
CREATE INDEX IF NOT EXISTS idx_spark_comments_spark ON public.spark_comments(spark_id, created_at DESC);

-- Keep reels.total_likes / total_comments in sync
CREATE OR REPLACE FUNCTION public.update_reel_like_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET total_likes = total_likes + 1 WHERE id = NEW.spark_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET total_likes = GREATEST(0, total_likes - 1) WHERE id = OLD.spark_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS spark_like_count_trigger ON public.spark_likes;
CREATE TRIGGER spark_like_count_trigger
  AFTER INSERT OR DELETE ON public.spark_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_reel_like_count();

CREATE OR REPLACE FUNCTION public.update_reel_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET total_comments = total_comments + 1 WHERE id = NEW.spark_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET total_comments = GREATEST(0, total_comments - 1) WHERE id = OLD.spark_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS spark_comment_count_trigger ON public.spark_comments;
CREATE TRIGGER spark_comment_count_trigger
  AFTER INSERT OR DELETE ON public.spark_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_reel_comment_count();

-- RLS
ALTER TABLE public.spark_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spark_reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spark_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spark_likes_select_all" ON public.spark_likes;
CREATE POLICY "spark_likes_select_all"
  ON public.spark_likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "spark_likes_insert_own" ON public.spark_likes;
CREATE POLICY "spark_likes_insert_own"
  ON public.spark_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "spark_likes_delete_own" ON public.spark_likes;
CREATE POLICY "spark_likes_delete_own"
  ON public.spark_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "spark_reposts_select_all" ON public.spark_reposts;
CREATE POLICY "spark_reposts_select_all"
  ON public.spark_reposts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "spark_reposts_insert_own" ON public.spark_reposts;
CREATE POLICY "spark_reposts_insert_own"
  ON public.spark_reposts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "spark_reposts_delete_own" ON public.spark_reposts;
CREATE POLICY "spark_reposts_delete_own"
  ON public.spark_reposts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "spark_comments_select_all" ON public.spark_comments;
CREATE POLICY "spark_comments_select_all"
  ON public.spark_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "spark_comments_insert_own" ON public.spark_comments;
CREATE POLICY "spark_comments_insert_own"
  ON public.spark_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "spark_comments_delete_own" ON public.spark_comments;
CREATE POLICY "spark_comments_delete_own"
  ON public.spark_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());
