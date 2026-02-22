-- Allow authenticated users to create their own profile row
-- (safety net alongside the handle_new_user trigger)
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());
