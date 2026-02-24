-- LinkedIn discovery + enrichment audit log columns
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS linkedin_company TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS enrichment_log JSONB;
