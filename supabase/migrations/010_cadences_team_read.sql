-- Allow all authenticated users to READ cadences (for team view).
-- Write policies (INSERT, UPDATE, DELETE) remain restricted to owner.

DROP POLICY IF EXISTS "cadences_read" ON public.cadences;

CREATE POLICY "cadences_read" ON public.cadences FOR SELECT
  TO authenticated USING (true);
