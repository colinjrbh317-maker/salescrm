-- Sales CRM Schema — Initial Migration
-- Run via Supabase SQL Editor or setup_db.py

-- =============================================================================
-- 1. PROFILES (extends Supabase Auth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'salesperson' CHECK (role IN ('admin', 'salesperson')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_read" ON public.profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  TO authenticated USING (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'salesperson');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 2. LEADS (core lead table)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity (from discovery)
  name                TEXT NOT NULL,
  category            TEXT,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  postal_code         TEXT,
  phone               TEXT,
  email               TEXT,
  website             TEXT,
  google_maps_url     TEXT,
  -- Social
  instagram           TEXT,
  tiktok              TEXT,
  facebook            TEXT,
  other_social        TEXT,
  -- Discovery metadata
  google_rating       REAL,
  review_count        INTEGER DEFAULT 0,
  sources             TEXT[],
  -- Scoring (from prospecting pipeline)
  composite_score     INTEGER DEFAULT 0,
  priority            TEXT CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  has_website         BOOLEAN DEFAULT FALSE,
  ssl_valid           BOOLEAN DEFAULT FALSE,
  mobile_friendly     BOOLEAN DEFAULT FALSE,
  design_score        INTEGER,
  content_freshness   TEXT,
  technical_score     INTEGER,
  visual_score        INTEGER,
  content_score       INTEGER,
  mobile_score        INTEGER,
  presence_score      INTEGER,
  -- CRM fields
  pipeline_stage      TEXT NOT NULL DEFAULT 'cold'
                      CHECK (pipeline_stage IN (
                        'cold', 'contacted', 'warm', 'proposal',
                        'negotiation', 'closed_won', 'closed_lost', 'dead'
                      )),
  assigned_to         UUID REFERENCES auth.users(id),
  -- AI fields
  ai_briefing         JSONB,
  ai_channel_rec      TEXT CHECK (ai_channel_rec IN (
    'cold_call', 'cold_email', 'social_dm', 'walk_in'
  )),
  -- Lifecycle
  last_contacted_at   TIMESTAMPTZ,
  next_followup_at    TIMESTAMPTZ,
  dead_at             TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  close_reason        TEXT,
  close_amount        NUMERIC(10,2),
  is_hot              BOOLEAN DEFAULT FALSE,
  -- Sync tracking
  sheets_sync_key     TEXT UNIQUE,
  last_synced_at      TIMESTAMPTZ,
  last_prospected_at  TIMESTAMPTZ,
  -- Timestamps
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_pipeline ON public.leads(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON public.leads(priority, composite_score);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON public.leads(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_dead_resurface ON public.leads(dead_at) WHERE pipeline_stage = 'dead';
CREATE INDEX IF NOT EXISTS idx_leads_sync_key ON public.leads(sheets_sync_key);
CREATE INDEX IF NOT EXISTS idx_leads_hot ON public.leads(is_hot) WHERE is_hot = TRUE;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_read" ON public.leads FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "leads_insert" ON public.leads FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "leads_update" ON public.leads FOR UPDATE
  TO authenticated USING (
    assigned_to = auth.uid()
    OR assigned_to IS NULL
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 3. PIPELINE HISTORY (auto-logged stage transitions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pipeline_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id),
  from_stage    TEXT,
  to_stage      TEXT NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_history_lead ON public.pipeline_history(lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_history_analytics ON public.pipeline_history(to_stage, created_at);

ALTER TABLE public.pipeline_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_history_read" ON public.pipeline_history FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "pipeline_history_insert" ON public.pipeline_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- Auto-log pipeline changes + set lifecycle timestamps
CREATE OR REPLACE FUNCTION public.log_pipeline_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage THEN
    INSERT INTO public.pipeline_history (lead_id, user_id, from_stage, to_stage)
    VALUES (NEW.id, auth.uid(), OLD.pipeline_stage, NEW.pipeline_stage);

    IF NEW.pipeline_stage = 'dead' THEN
      NEW.dead_at = NOW();
    END IF;

    IF NEW.pipeline_stage IN ('closed_won', 'closed_lost') THEN
      NEW.closed_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS leads_pipeline_change ON public.leads;
CREATE TRIGGER leads_pipeline_change
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_pipeline_change();

-- =============================================================================
-- 4. ACTIVITIES (outreach touchpoints)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  activity_type   TEXT NOT NULL CHECK (activity_type IN (
    'cold_call', 'cold_email', 'social_dm', 'walk_in',
    'follow_up_call', 'follow_up_email', 'meeting', 'proposal_sent',
    'note', 'stage_change'
  )),
  channel         TEXT CHECK (channel IN (
    'phone', 'email', 'instagram', 'tiktok', 'facebook',
    'linkedin', 'in_person', 'other'
  )),
  outcome         TEXT CHECK (outcome IN (
    'connected', 'voicemail', 'no_answer', 'callback_requested',
    'interested', 'not_interested', 'wrong_number', 'sent', 'opened',
    'replied', 'bounced', 'meeting_set', 'proposal_requested', 'other'
  )),
  notes           TEXT,
  is_private      BOOLEAN DEFAULT TRUE,
  duration_sec    INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  occurred_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON public.activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user ON public.activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON public.activities(activity_type);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_read" ON public.activities FOR SELECT
  TO authenticated USING (
    is_private = FALSE
    OR user_id = auth.uid()
  );

CREATE POLICY "activities_insert" ON public.activities FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "activities_update" ON public.activities FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

-- =============================================================================
-- 5. CADENCES (follow-up sequences)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cadences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  step_number     INTEGER NOT NULL DEFAULT 1,
  channel         TEXT NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  skipped         BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cadences_pending ON public.cadences(scheduled_at)
  WHERE completed_at IS NULL AND skipped = FALSE;
CREATE INDEX IF NOT EXISTS idx_cadences_lead ON public.cadences(lead_id);
CREATE INDEX IF NOT EXISTS idx_cadences_user ON public.cadences(user_id);

ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cadences_read" ON public.cadences FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "cadences_insert" ON public.cadences FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "cadences_update" ON public.cadences FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "cadences_delete" ON public.cadences FOR DELETE
  TO authenticated USING (user_id = auth.uid());
