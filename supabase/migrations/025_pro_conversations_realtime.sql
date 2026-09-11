-- Enable realtime for pro_conversations (hero inquiry counters + leads drawer)

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pro_conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Keep updated_at fresh when new messages arrive (quote inquiry window)
CREATE OR REPLACE FUNCTION public.touch_pro_conversation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.pro_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pro_messages_touch_conversation ON public.pro_messages;
CREATE TRIGGER trg_pro_messages_touch_conversation
  AFTER INSERT ON public.pro_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_pro_conversation_updated_at();
