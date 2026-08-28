-- Spark reel audio track metadata (music picker)

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS audio_track_id TEXT,
  ADD COLUMN IF NOT EXISTS audio_title TEXT,
  ADD COLUMN IF NOT EXISTS audio_artist TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

CREATE INDEX IF NOT EXISTS idx_reels_audio_track ON public.reels(audio_track_id);
