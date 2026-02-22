-- Add follower count columns for creator/podcast enrichment
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS instagram_followers INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tiktok_followers INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS facebook_followers INTEGER;
