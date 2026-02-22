-- Add onboarding fields to profiles
-- onboarding_completed: gates dashboard access until wizard is done
-- preferred_channels: salesperson's preferred outreach channels
-- goals: daily/monthly KPI targets as JSONB

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preferred_channels TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS goals JSONB DEFAULT NULL;

-- Update the handle_new_user trigger to set onboarding_completed = FALSE explicitly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'salesperson',
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
