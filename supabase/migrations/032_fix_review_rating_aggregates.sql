-- Fix review aggregates: SECURITY DEFINER trigger so buyer ratings update pros/shops
-- despite RLS that only allows owners to UPDATE their own rows.

CREATE OR REPLACE FUNCTION public.recompute_target_rating(
  p_target_id UUID,
  p_target_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_avg NUMERIC(3,2);
  new_count INT;
BEGIN
  IF p_target_id IS NULL OR p_target_type IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::NUMERIC(3,2),
    COUNT(*)::INT
  INTO new_avg, new_count
  FROM public.reviews
  WHERE target_id = p_target_id
    AND target_type = p_target_type;

  IF p_target_type = 'shop' THEN
    UPDATE public.shops
    SET avg_rating = COALESCE(new_avg, 0),
        total_reviews = COALESCE(new_count, 0)
    WHERE id = p_target_id;
  ELSIF p_target_type = 'service_provider' THEN
    UPDATE public.service_providers
    SET avg_rating = COALESCE(new_avg, 0),
        total_reviews = COALESCE(new_count, 0)
    WHERE id = p_target_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_target_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_target_rating(
    COALESCE(NEW.target_id, OLD.target_id),
    COALESCE(NEW.target_type, OLD.target_type)
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS review_rating_trigger ON public.reviews;
CREATE TRIGGER review_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_target_rating();

-- Backfill existing reviews onto shops / service_providers
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT target_id, target_type FROM public.reviews
  LOOP
    PERFORM public.recompute_target_rating(r.target_id, r.target_type);
  END LOOP;

  UPDATE public.service_providers sp
  SET avg_rating = 0, total_reviews = 0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reviews rv
    WHERE rv.target_id = sp.id AND rv.target_type = 'service_provider'
  )
  AND (COALESCE(sp.total_reviews, 0) <> 0 OR COALESCE(sp.avg_rating, 0) <> 0);

  UPDATE public.shops sh
  SET avg_rating = 0, total_reviews = 0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reviews rv
    WHERE rv.target_id = sh.id AND rv.target_type = 'shop'
  )
  AND (COALESCE(sh.total_reviews, 0) <> 0 OR COALESCE(sh.avg_rating, 0) <> 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_target_rating(UUID, TEXT) TO authenticated;
