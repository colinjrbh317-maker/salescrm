-- Messages table: stores generated outreach messages with versioning and attribution
-- Supports: version history, reply tracking, regeneration with direction, cadence linking

-- =============================================================================
-- 1. MESSAGES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  cadence_id          UUID REFERENCES public.cadences(id) ON DELETE SET NULL,
  user_id             UUID NOT NULL REFERENCES auth.users(id),
  -- Content
  channel             TEXT NOT NULL CHECK (channel IN (
    'phone', 'email', 'instagram', 'tiktok', 'facebook',
    'linkedin', 'in_person', 'other'
  )),
  subject             TEXT,
  body                TEXT NOT NULL,
  -- Generation metadata
  template_used       TEXT,
  cadence_step        INTEGER,
  angle               TEXT,
  cta_type            TEXT CHECK (cta_type IN (
    'full_offer', 'mockup_tease', 'conversation', 'question'
  )),
  research_highlights JSONB,
  -- Regeneration
  direction           TEXT,
  version             INTEGER NOT NULL DEFAULT 1,
  parent_message_id   UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  -- Status and sending
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'replied'
  )),
  activity_id         UUID REFERENCES public.activities(id) ON DELETE SET NULL,
  send_note           TEXT,
  -- Timestamps
  generated_at        TIMESTAMPTZ DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  metadata            JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_messages_lead
  ON public.messages(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_cadence
  ON public.messages(cadence_id) WHERE cadence_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_status
  ON public.messages(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_parent
  ON public.messages(parent_message_id) WHERE parent_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_user
  ON public.messages(user_id, created_at DESC);

-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_read" ON public.messages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

-- =============================================================================
-- 4. ACTIVITIES TABLE: add message_id and cadence_id columns
-- =============================================================================
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS cadence_id UUID REFERENCES public.cadences(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_message
  ON public.activities(message_id) WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_cadence
  ON public.activities(cadence_id) WHERE cadence_id IS NOT NULL;
