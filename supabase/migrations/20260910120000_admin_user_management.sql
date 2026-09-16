-- ==============================================================================
-- Admin user management: audit trail + Auth login activity helper
-- Migration: 20260910120000_admin_user_management.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON public.admin_audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_target
  ON public.admin_audit_events (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor
  ON public.admin_audit_events (actor_id, created_at DESC);

COMMENT ON TABLE public.admin_audit_events IS
  'Admin actions on users (role changes, bans, invites). Separate from Supabase Auth audit logs.';

ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_select" ON public.admin_audit_events
FOR SELECT USING (public.is_admin());

CREATE POLICY "admin_audit_insert" ON public.admin_audit_events
FOR INSERT WITH CHECK (public.is_admin());

-- No update/delete for normal admins — append-only trail.
-- Service role bypasses RLS if needed for maintenance.

-- ------------------------------------------------------------------------------
-- Read recent Auth login-related events for one user (service/admin only via RLS)
-- Requires Auth audit logs stored in Postgres (project setting). Returns empty if none.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_user_auth_events(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    action TEXT,
    ip_address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.created_at,
    COALESCE(e.payload->>'action', e.payload->>'act', 'unknown')::text AS action,
    COALESCE(e.ip_address::text, e.payload->>'ip_address', NULL)::text AS ip_address
  FROM auth.audit_log_entries e
  WHERE
    (e.payload->>'actor_id') = p_user_id::text
    OR (e.payload->>'user_id') = p_user_id::text
    OR (e.payload->'actor'->>'id') = p_user_id::text
  ORDER BY e.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_user_auth_events(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_user_auth_events(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_user_auth_events(UUID, INTEGER) TO service_role;
