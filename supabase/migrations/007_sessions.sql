-- Sessions table: focused "power mode" for batch-processing leads
-- Tracks session state, queue position, outcomes, and streaks

CREATE TABLE IF NOT EXISTS public.sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type      TEXT NOT NULL CHECK (session_type IN ('email', 'call', 'dm', 'mixed')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  leads_worked      INTEGER NOT NULL DEFAULT 0,
  leads_skipped     INTEGER NOT NULL DEFAULT 0,
  outcomes_summary  JSONB DEFAULT '{}',
  lead_queue        UUID[] NOT NULL DEFAULT '{}',
  current_index     INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  streak_best       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding active sessions quickly
CREATE INDEX IF NOT EXISTS idx_sessions_active
  ON public.sessions(user_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON public.sessions(user_id, started_at DESC);

-- RLS: users can only see/edit their own sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_read" ON public.sessions FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "sessions_insert" ON public.sessions FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "sessions_update" ON public.sessions FOR UPDATE
  TO authenticated USING (user_id = auth.uid());
