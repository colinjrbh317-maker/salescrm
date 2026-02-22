-- Scripts and script comments tables
-- Stores sales script content and per-paragraph inline comments

-- Scripts table
CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,        -- e.g. 'cold-email', 'social-dm', 'cold-call', 'in-person', 'response-handling', 'closing', 'post-sale', 'sops'
  subcategory TEXT,              -- e.g. 'email', 'instagram', 'facebook', 'linkedin'
  file_path TEXT NOT NULL,       -- relative path from sales-scripts/, e.g. 'cold-outreach/email/first-touch-personalized-A.md'
  content TEXT NOT NULL,         -- full markdown content
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Script comments table
CREATE TABLE IF NOT EXISTS public.script_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  paragraph_index INT NOT NULL,   -- which paragraph (0-indexed)
  paragraph_text TEXT NOT NULL,   -- the paragraph content for context
  comment TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_script_comments_script ON public.script_comments(script_id);
CREATE INDEX IF NOT EXISTS idx_scripts_category ON public.scripts(category);

-- RLS
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_comments ENABLE ROW LEVEL SECURITY;

-- Policies (authenticated users can read/write)
CREATE POLICY "Authenticated users can view scripts" ON public.scripts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update scripts" ON public.scripts
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view comments" ON public.script_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert comments" ON public.script_comments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update comments" ON public.script_comments
  FOR UPDATE TO authenticated USING (true);
