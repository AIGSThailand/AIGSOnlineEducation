-- ==============================================================================
-- Course groups / bundles — Stripe commerce fields + public catalog read
-- Migration: 20260909160000_group_bundle_commerce.sql
-- ==============================================================================

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

CREATE INDEX IF NOT EXISTS idx_groups_stripe_price ON public.groups (stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;

COMMENT ON COLUMN public.groups.stripe_product_id IS
  'Optional Stripe Product for this group/bundle checkout.';
COMMENT ON COLUMN public.groups.stripe_price_id IS
  'Optional Stripe Price — one purchase enrolls the buyer into all group_courses.';

-- Allow authenticated/anon to see active groups (bundle catalog) without membership.
CREATE POLICY "groups_select_active_catalog" ON public.groups
FOR SELECT USING (status = 'active');

-- Allow reading course membership of active groups (bundle contents).
CREATE POLICY "group_courses_select_active_group" ON public.group_courses
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_courses.group_id
      AND g.status = 'active'
  )
);
