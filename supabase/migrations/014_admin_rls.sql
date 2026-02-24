-- Admin role RLS upgrades
-- 1) Admin can read ALL activities (including private)
-- 2) Only admin can delete leads
-- 3) Admin can update/delete any cadence

-- ============================================================
-- Activities: admin sees everything
-- ============================================================
DROP POLICY IF EXISTS "activities_read" ON public.activities;

CREATE POLICY "activities_read" ON public.activities FOR SELECT
  TO authenticated USING (
    is_private = FALSE
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- Leads: restrict delete to admin only
-- ============================================================
DROP POLICY IF EXISTS "leads_delete" ON public.leads;

CREATE POLICY "leads_delete" ON public.leads FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- Cadences: admin can update/delete any cadence
-- ============================================================
DROP POLICY IF EXISTS "cadences_update" ON public.cadences;

CREATE POLICY "cadences_update" ON public.cadences FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "cadences_delete" ON public.cadences;

CREATE POLICY "cadences_delete" ON public.cadences FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
