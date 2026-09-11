-- Reliable story create with latched audio + backfill from matching Moments

CREATE OR REPLACE FUNCTION public.create_story_with_audio(
  p_author_id UUID,
  p_media_url TEXT,
  p_media_type TEXT,
  p_caption TEXT DEFAULT '',
  p_shop_id UUID DEFAULT NULL,
  p_service_provider_id UUID DEFAULT NULL,
  p_audio_track_id TEXT DEFAULT NULL,
  p_audio_title TEXT DEFAULT NULL,
  p_audio_artist TEXT DEFAULT NULL,
  p_audio_url TEXT DEFAULT NULL,
  p_audio_start_time DOUBLE PRECISION DEFAULT 0,
  p_audio_volume_balance JSONB DEFAULT NULL
)
RETURNS public.stories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  row public.stories;
  balance JSONB;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_author_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_shop_id IS NULL AND p_service_provider_id IS NULL THEN
    RAISE EXCEPTION 'A shop or service provider is required';
  END IF;
  IF p_shop_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.shops WHERE id = p_shop_id AND owner_id = uid
  ) THEN
    RAISE EXCEPTION 'Not allowed to post for this shop' USING ERRCODE = '42501';
  END IF;
  IF p_service_provider_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_providers WHERE id = p_service_provider_id AND profile_id = uid
  ) THEN
    RAISE EXCEPTION 'Not allowed to post for this service profile' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_publisher() THEN
    RAISE EXCEPTION 'Publisher is not active' USING ERRCODE = '42501';
  END IF;

  balance := COALESCE(
    p_audio_volume_balance,
    CASE WHEN p_audio_url IS NOT NULL AND btrim(p_audio_url) <> ''
      THEN '{"video":0,"music":100}'::jsonb
      ELSE NULL
    END
  );

  INSERT INTO public.stories (
    shop_id,
    service_provider_id,
    author_id,
    media_url,
    media_type,
    caption,
    audio_track_id,
    audio_title,
    audio_artist,
    audio_url,
    audio_start_time,
    audio_volume_balance,
    expires_at
  ) VALUES (
    p_shop_id,
    p_service_provider_id,
    p_author_id,
    p_media_url,
    COALESCE(NULLIF(p_media_type, ''), 'image'),
    COALESCE(p_caption, ''),
    p_audio_track_id,
    p_audio_title,
    p_audio_artist,
    NULLIF(btrim(COALESCE(p_audio_url, '')), ''),
    COALESCE(p_audio_start_time, 0),
    balance,
    NOW() + INTERVAL '24 hours'
  )
  RETURNING * INTO row;

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_story_with_audio(
  UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_story_with_audio(
  UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, JSONB
) TO authenticated;

UPDATE public.stories st
SET
  audio_track_id = COALESCE(st.audio_track_id, r.audio_track_id),
  audio_title = COALESCE(st.audio_title, r.audio_title),
  audio_artist = COALESCE(st.audio_artist, r.audio_artist),
  audio_url = COALESCE(st.audio_url, r.audio_url),
  audio_start_time = COALESCE(st.audio_start_time, r.audio_start_time, 0),
  audio_volume_balance = COALESCE(
    st.audio_volume_balance,
    r.audio_volume_balance,
    '{"video":0,"music":100}'::jsonb
  )
FROM public.reels r
WHERE st.author_id = r.author_id
  AND st.media_url = r.media_url
  AND (st.audio_url IS NULL OR btrim(st.audio_url) = '')
  AND r.audio_url IS NOT NULL
  AND btrim(r.audio_url) <> ''
  AND st.created_at > NOW() - INTERVAL '7 days'
  AND abs(EXTRACT(EPOCH FROM (st.created_at - r.created_at))) < 30;

NOTIFY pgrst, 'reload schema';
