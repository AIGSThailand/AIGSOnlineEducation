-- App-level auth rate limiting (login / register / forgot-password).
-- Accessed via SECURITY DEFINER RPC; no client RLS policies.

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  bucket TEXT PRIMARY KEY,
  hit_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.auth_rate_limits IS
  'Sliding fixed-window counters for auth abuse protection. Written only via bump_auth_rate_limit RPC.';

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: clients cannot read/write; service role and SECURITY DEFINER bypass.

CREATE OR REPLACE FUNCTION public.bump_auth_rate_limit(
  p_bucket TEXT,
  p_window_seconds INTEGER,
  p_max_hits INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_count INTEGER;
  v_started TIMESTAMPTZ;
BEGIN
  IF p_bucket IS NULL OR length(trim(p_bucket)) = 0 THEN
    RETURN FALSE;
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RETURN FALSE;
  END IF;
  IF p_max_hits IS NULL OR p_max_hits < 1 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.auth_rate_limits (bucket, hit_count, window_started_at)
  VALUES (p_bucket, 1, v_now)
  ON CONFLICT (bucket) DO UPDATE
  SET
    hit_count = CASE
      WHEN public.auth_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        THEN 1
      ELSE public.auth_rate_limits.hit_count + 1
    END,
    window_started_at = CASE
      WHEN public.auth_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        THEN v_now
      ELSE public.auth_rate_limits.window_started_at
    END
  RETURNING hit_count, window_started_at INTO v_count, v_started;

  RETURN v_count <= p_max_hits;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_auth_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_auth_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.bump_auth_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_auth_rate_limit(TEXT, INTEGER, INTEGER) TO anon;
