-- Add enrichment and notes columns to leads table
-- Run via Supabase SQL Editor

-- Enrichment columns (owner info from web research)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Notes column (JSONB array of timestamped notes)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;

-- Index for quick "enriched vs not" filtering
CREATE INDEX IF NOT EXISTS idx_leads_enriched ON public.leads(enriched_at) WHERE enriched_at IS NOT NULL;
