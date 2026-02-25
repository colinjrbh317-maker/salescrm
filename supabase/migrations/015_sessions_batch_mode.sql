-- Add batch mode flag for email/DM session workflows
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS batch_mode boolean NOT NULL DEFAULT false;
