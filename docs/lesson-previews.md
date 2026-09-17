# Free lesson previews

In Course Builder, select a lesson, open Settings, and enable **Allow free preview before enrollment**. The switch saves independently of lesson autosave and displays save failures. Admins and assigned instructors can manage it. New or duplicated course/lesson pairs have no preview permission by default.

Both course and lesson must be published. Private courses cannot expose previews. The configuration is specific to a course/lesson pair; reused content does not automatically become previewable in another course. Full lesson text and embedded video/images become public; do not include confidential material in preview copy. Resource lists, topics, quizzes, progress, and certification stay outside preview access. Public third-party media is subject to its host's access controls.

Visitors select **Free preview** from the public syllabus. The player shows an enrollment link and no completion controls. Existing enrolled/staff access and progression remain unchanged. Preview links bypass linear prerequisites only for visitors viewing public preview content.

## Deployment

Apply `20260917000000_public_course_lesson_metadata.sql` and then `20260917010000_course_lesson_previews.sql` to local/staging before deploying the dependent app changes. No new environment variables are required. Existing lesson RLS and course entitlement helpers are unchanged; public content is exposed only by the narrow preview RPC. Preview configuration uses RLS and caller privileges.

Run `npm run test:lesson-preview` plus the SQL assertions in `supabase/tests/lesson-previews.sql` against an isolated local database after migrations. The SQL fixture rolls back. Never run the fixture against production. Test the switch, anonymous browser navigation, paid lesson denial, protected resources, enrolled playback and cross-course reuse in staging before promotion.

Preview media requests carry the course and lesson context. Each request rechecks eligibility and exact file references. Disabling a preview stops new authorized requests; previously issued signed URLs expire according to the existing S3 signed URL lifetime. Already downloaded files and public CDN/third-party URLs cannot be revoked by this switch.

For rollback, disable preview configurations before reverting app code. The additive table/functions may remain; avoid destructive schema rollback while the app still calls them.
