-- Transactional email: SMTP config, templates, and send logs.
-- Secrets stay in password_ciphertext. No grants for anon or authenticated.
-- The app reads and writes these tables only with the service role, after an admin check.
-- Rows are scoped by app_env so local, staging, and production do not share a mailbox.

CREATE TABLE public.email_smtp_configs (
  app_env text PRIMARY KEY CHECK (app_env IN ('local', 'staging', 'production')),
  host text NOT NULL,
  port integer NOT NULL CHECK (port > 0 AND port < 65536),
  secure boolean NOT NULL DEFAULT false,
  username text,
  password_ciphertext text,
  from_email text NOT NULL,
  from_name text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.email_smtp_configs IS
  'Per-environment SMTP settings. password_ciphertext is AES-GCM and is never returned to the browser.';
COMMENT ON COLUMN public.email_smtp_configs.password_ciphertext IS
  'Server-only encrypted SMTP password. Decrypt with EMAIL_SECRETS_KEY.';

CREATE TABLE public.email_templates (
  app_env text NOT NULL CHECK (app_env IN ('local', 'staging', 'production')),
  event_key text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (app_env, event_key)
);

COMMENT ON TABLE public.email_templates IS
  'Admin overrides for transactional templates. Absence of a row means the code default. Send by event_key, never by row id.';

CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_env text NOT NULL CHECK (app_env IN ('local', 'staging', 'production')),
  event_key text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX email_logs_created_at_idx ON public.email_logs (app_env, created_at DESC);

COMMENT ON TABLE public.email_logs IS
  'One row per transactional send attempt. Does not store SMTP passwords or full HTML bodies.';

ALTER TABLE public.email_smtp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_smtp_configs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.email_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.email_logs FROM PUBLIC, anon, authenticated;
