-- Profile push notification preference

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT TRUE;
