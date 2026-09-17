-- Stripe webhook idempotency: claim each event.id once (service-role only).

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.processed_stripe_events IS
  'Dedupes Stripe webhook deliveries. Written only by service role from /api/stripe/webhook.';

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated cannot read or write; service role bypasses RLS.
