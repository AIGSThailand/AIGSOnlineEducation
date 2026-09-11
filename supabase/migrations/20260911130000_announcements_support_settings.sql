-- ==============================================================================
-- Announcements, Support tickets, Platform settings
-- Migration: 20260911130000_announcements_support_settings.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.announcement_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.announcement_audience AS ENUM ('all', 'students', 'instructors', 'admins');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.support_ticket_status AS ENUM ('open', 'pending', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.support_ticket_priority AS ENUM ('low', 'normal', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- Platform settings (key / jsonb value)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT 'null'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.platform_settings IS
  'Platform-wide configuration keys (site_name, support_email, maintenance_mode, …).';

INSERT INTO public.platform_settings (key, value) VALUES
  ('site_name', '"AIGS Online Education"'::jsonb),
  ('support_email', 'null'::jsonb),
  ('support_from_name', '"AIGS Support"'::jsonb),
  ('maintenance_mode', 'false'::jsonb),
  ('announcement_banner_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings_select_authenticated"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "platform_settings_manage_admin"
  ON public.platform_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- Announcements
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body_html TEXT NOT NULL DEFAULT '',
    status public.announcement_status NOT NULL DEFAULT 'draft',
    audience public.announcement_audience NOT NULL DEFAULT 'all',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_announcements_feed
  ON public.announcements (status, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_announcements_created
  ON public.announcements (created_at DESC);

CREATE TRIGGER tr_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE OR REPLACE FUNCTION public.can_view_announcement(p_audience public.announcement_audience)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR p_audience = 'all'
    OR (p_audience = 'students' AND public.current_user_role() = 'student')
    OR (p_audience = 'instructors' AND public.current_user_role() = 'instructor')
    OR (p_audience = 'admins' AND public.current_user_role() = 'admin');
$$;

REVOKE ALL ON FUNCTION public.can_view_announcement(public.announcement_audience) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_announcement(public.announcement_audience) TO authenticated;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select"
  ON public.announcements FOR SELECT
  USING (
    public.is_admin()
    OR (
      status = 'published'
      AND public.can_view_announcement(audience)
      AND (starts_at IS NULL OR starts_at <= timezone('utc'::text, now()))
      AND (ends_at IS NULL OR ends_at >= timezone('utc'::text, now()))
    )
  );

CREATE POLICY "announcements_manage"
  ON public.announcements FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- Support tickets + messages
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status public.support_ticket_status NOT NULL DEFAULT 'open',
    priority public.support_ticket_priority NOT NULL DEFAULT 'normal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON public.support_tickets (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON public.support_tickets (status, updated_at DESC);

CREATE TRIGGER tr_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    is_staff BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket
  ON public.support_messages (ticket_id, created_at ASC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_select"
  ON public.support_tickets FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "support_tickets_insert"
  ON public.support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "support_tickets_update"
  ON public.support_tickets FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "support_tickets_delete"
  ON public.support_tickets FOR DELETE
  USING (public.is_admin());

CREATE POLICY "support_messages_select"
  ON public.support_messages FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "support_messages_insert"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_admin()
      OR (
        is_staff = false
        AND EXISTS (
          SELECT 1 FROM public.support_tickets t
          WHERE t.id = support_messages.ticket_id
            AND t.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "support_messages_delete"
  ON public.support_messages FOR DELETE
  USING (public.is_admin());
