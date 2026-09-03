# Staging troubleshooting — signup / profiles

If signup “works” but **no row in `profiles`**, work through these checks in order.

Related: [vercel-staging-setup.md](./vercel-staging-setup.md) · [environments.md](./environments.md)

---

## How signup should work

```text
Register form → supabase.auth.signUp()
      ↓
Row inserted into auth.users (staging Supabase)
      ↓
Trigger on_auth_user_created → handle_new_user()
      ↓
Row inserted into public.profiles
```

The app does **not** insert profiles directly — a **database trigger** does.

---

## 1. Confirm Vercel talks to STAGING Supabase (most common issue)

### Vercel (`aigs-lms-staging`)

**Settings → Environment Variables** — Production scope:

| Variable                        | Must be                                    |
| ------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://bjtukjxodwthempjjude.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Keys from **staging** project API settings |
| `SUPABASE_SERVICE_ROLE_KEY`     | Staging service role / secret key          |
| `NEXT_PUBLIC_APP_URL`           | Your staging Vercel URL (exact match)      |
| `APP_ENV`                       | `staging`                                  |

After any change → **Redeploy** (env vars are baked in at build time for `NEXT_PUBLIC_*`).

### Browser check (do this on live staging site)

1. Open staging site → **Register** page
2. **F12 → Network** tab
3. Submit registration
4. Find request to `supabase.co` (auth signup)
5. URL must contain **`bjtukjxodwthempjjude`**

If it shows a **different** project ref → Vercel env vars are wrong or deploy is stale.

---

## 2. Check Supabase staging (data)

Project: **bjtukjxodwthempjjude**

### Authentication → Users

After signup, is the user listed?

| Users table     | profiles table | Likely cause                                                           |
| --------------- | -------------- | ---------------------------------------------------------------------- |
| **No user**     | empty          | Wrong Supabase URL on Vercel, or signup error (check Network response) |
| **User exists** | **empty**      | Trigger failed — see step 3                                            |
| **User exists** | **row exists** | Data is fine — login/RLS/session issue                                 |

### Table Editor → `profiles`

Refresh after signup. Should have one row per user.

### SQL Editor — diagnostic queries

```sql
-- Users without profiles (should be 0 after fix migration)
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Trigger exists?
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- Function exists?
SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';
```

### Logs

**Logs → Postgres** or **Auth** — look for errors at signup time mentioning `handle_new_user` or `profiles`.

---

## 3. Apply profile trigger fix (if user exists but no profile)

Migration: `20260902143000_fix_profile_signup_trigger.sql`

On staging:

```powershell
supabase link --project-ref bjtukjxodwthempjjude
supabase db push
```

Or run the migration SQL manually in **SQL Editor**.

Then backfill is automatic in that migration. Re-check:

```sql
SELECT count(*) FROM public.profiles;
```

---

## 4. Email confirmation

If **Confirm email** is ON in staging Supabase:

- Signup shows: “Check your email…”
- User is still created in `auth.users` (profile trigger should still run)
- User **cannot log in** until email is confirmed

**Auth → URL configuration:**

- Site URL = staging Vercel URL
- Redirect URLs include `https://YOUR-STAGING-URL/api/auth/callback`

**Quick fix for testing:**

- Turn **Confirm email** OFF, or
- `npm run auth:verify-email -- --email you@example.com --role admin`  
  (with `.env.local` pointed at staging keys)

---

## 5. GitHub (staging)

GitHub does **not** affect signup at runtime. Only used for:

- CI build on PR
- Auto `supabase db push` when `supabase/migrations/**` changes on `develop`

Check:

- Repo → **Actions** — latest workflow green?
- **Settings → Secrets** — `SUPABASE_STAGING_PROJECT_REF` = `bjtukjxodwthempjjude`
- Branch **`develop`** pushed after migration fix

---

## 6. Git / Vercel deploy alignment

| Check               | Expected                                                  |
| ------------------- | --------------------------------------------------------- |
| Vercel project      | `aigs-lms-staging`                                        |
| Production branch   | `develop`                                                 |
| Latest deployment   | From `develop`, after env vars set                        |
| Supabase migrations | All applied (`supabase migration list` linked to staging) |

```powershell
supabase link --project-ref bjtukjxodwthempjjude
supabase migration list
```

All local migrations should show as applied on remote.

---

## Quick fix checklist

1. [ ] Vercel `NEXT_PUBLIC_SUPABASE_URL` = `https://bjtukjxodwthempjjude.supabase.co`
2. [ ] Redeploy staging after env change
3. [ ] Network tab shows signup → `bjtukjxodwthempjjude.supabase.co`
4. [ ] User appears in staging **Authentication → Users**
5. [ ] Run `supabase db push` for profile trigger fix
6. [ ] `profiles` row exists (or backfill SQL above)
7. [ ] Auth redirect URLs match staging domain
8. [ ] Email confirmed or confirmation disabled for testing

---

## Manual profile insert (emergency only)

If user exists in Auth but no profile:

```sql
INSERT INTO public.profiles (id, email, first_name, last_name, role)
SELECT
  id,
  email,
  raw_user_meta_data->>'first_name',
  raw_user_meta_data->>'last_name',
  'student'::public.user_role
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE'
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.users.id);
```

Prefer the migration backfill over one-off inserts.
