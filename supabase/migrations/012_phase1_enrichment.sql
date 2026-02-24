-- Phase 1 enrichment upgrades: Google Places, tech stack, dead-check, competitor data
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS google_place_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS google_hours JSONB;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tech_stack TEXT[];
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_parked_domain BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS review_sentiment JSONB;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS competitor_data JSONB;
