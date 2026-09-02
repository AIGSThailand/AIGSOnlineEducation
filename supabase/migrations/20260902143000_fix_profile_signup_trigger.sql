-- Fix profile auto-create trigger for hosted Supabase (search_path + safe role cast).
-- Backfills any auth.users rows missing a profiles row.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role public.user_role;
  meta_role text;
BEGIN
  meta_role := NEW.raw_user_meta_data->>'role';

  BEGIN
    IF meta_role IS NULL OR meta_role = '' THEN
      assigned_role := 'student'::public.user_role;
    ELSE
      assigned_role := meta_role::public.user_role;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      assigned_role := 'student'::public.user_role;
  END;

  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'avatar_url',
    assigned_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for users created before this fix
INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url, role)
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'first_name',
  u.raw_user_meta_data->>'last_name',
  u.raw_user_meta_data->>'avatar_url',
  CASE
    WHEN u.raw_user_meta_data->>'role' IN ('admin', 'instructor', 'student')
      THEN (u.raw_user_meta_data->>'role')::public.user_role
    ELSE 'student'::public.user_role
  END
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);
