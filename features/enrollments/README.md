# Enrollments domain

Source-aware course access records.

## Table
- `enrollments`

## Sources
`manual` | `stripe` | `migration` | `group` | `admin`

Stripe webhook sets `enrollment_source = 'stripe'` with checkout session and payment intent references.
