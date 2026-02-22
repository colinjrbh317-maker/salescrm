-- Add shared_notes field to leads for team-visible notes
-- This is a simple text field that any team member can see and edit

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS shared_notes TEXT DEFAULT '';
