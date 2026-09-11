-- Include service_provider_id so client can group Instagram-style rings correctly
DROP FUNCTION IF EXISTS public.stories_for_user(UUID);

CREATE OR REPLACE FUNCTION public.stories_for_user(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  shop_id UUID,
  service_provider_id UUID,
  author_id UUID,
  media_url TEXT,
  media_type TEXT,
  caption TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  shop_name TEXT,
  shop_logo TEXT,
  audio_track_id TEXT,
  audio_title TEXT,
  audio_artist TEXT,
  audio_url TEXT,
  audio_start_time DOUBLE PRECISION,
  audio_volume_balance JSONB,
  deleted_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    st.id,
    st.shop_id,
    st.service_provider_id,
    st.author_id,
    st.media_url,
    st.media_type,
    st.caption,
    st.expires_at,
    st.created_at,
    COALESCE(s.name, sp.business_name) AS shop_name,
    COALESCE(s.logo_url, NULLIF(sp.portfolio_photos[1], '')) AS shop_logo,
    st.audio_track_id,
    st.audio_title,
    st.audio_artist,
    st.audio_url,
    COALESCE(st.audio_start_time, 0),
    COALESCE(st.audio_volume_balance, '{"video":0,"music":100}'::jsonb),
    st.deleted_at
  FROM public.stories st
  LEFT JOIN public.shops s ON s.id = st.shop_id
  LEFT JOIN public.service_providers sp ON sp.id = st.service_provider_id
  WHERE st.expires_at > NOW()
    AND st.deleted_at IS NULL
    AND (
      st.author_id = p_user_id
      OR st.shop_id IN (
        SELECT shop_id FROM public.shop_followers WHERE user_id = p_user_id
      )
      OR st.service_provider_id IN (
        SELECT id FROM public.service_providers WHERE profile_id = p_user_id
      )
    )
  ORDER BY st.created_at DESC;
$$;

NOTIFY pgrst, 'reload schema';
