-- Keep the selected user-owned preset attached to the conversation.
-- Preset instructions are resolved server-side with both preset ID and user ID.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS preset_id uuid
  REFERENCES public.presets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_preset_id_idx
  ON public.conversations (preset_id);
