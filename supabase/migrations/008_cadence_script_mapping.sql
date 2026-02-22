-- Add script mapping to cadences
-- script_id: FK to scripts table for auto-loading the right script
-- template_name: which cadence template was used to create this step

ALTER TABLE public.cadences
  ADD COLUMN IF NOT EXISTS script_id UUID REFERENCES public.scripts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_name TEXT;
