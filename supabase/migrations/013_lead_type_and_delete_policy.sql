-- Add lead_type column (expected by TypeScript types but missing from schema)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_type TEXT NOT NULL DEFAULT 'business'
  CHECK (lead_type IN ('business', 'creator', 'podcaster'));

-- Add DELETE policy on leads (was missing, required service role bypass before)
CREATE POLICY "leads_delete" ON public.leads FOR DELETE
  TO authenticated USING (true);

-- Mark abandoned sessions as inactive after 24 hours
-- Sessions left active with no activity for over 24h are stale
UPDATE public.sessions
SET status = 'completed',
    ended_at = NOW()
WHERE status = 'active'
  AND started_at < NOW() - INTERVAL '24 hours';
