# Enrollments domain

Source-aware course access records.

## Table

- `enrollments`
  - `expires_at` — optional end of access (null = unlimited)
  - `status` includes `expired`

## Course defaults

- `courses.access_expiration_enabled`
- `courses.access_period_days` — applied to **new** Stripe enrollments when enabled

## Sources

`manual` | `stripe` | `migration` | `group` | `admin`

Stripe webhook sets `enrollment_source = 'stripe'` with checkout session and payment intent references. When course access expiration is enabled, Stripe enrollments also set `expires_at`.

## Extend Access (LearnDash parity)

- UI: Course Builder → Settings → **Extend Access**
- Actions: `extendAccessAction`, `clearAccessExpirationAction`, `updateCourseAccessExpirationAction`
- Access checks: `canAccessCourse` + SQL `is_enrolled_in_course` require `expires_at IS NULL OR expires_at > now()`
- Ops: `expire_overdue_enrollments()` (service_role) marks overdue rows as `expired`
