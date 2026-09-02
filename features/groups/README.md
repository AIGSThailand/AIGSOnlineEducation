# Groups domain

LearnDash-style groups with relationship-based leadership.

## Tables
- `groups`
- `group_users`
- `group_leaders`
- `group_courses`

## Access model
Recommended: materialize `enrollments` with `enrollment_source = 'group'` when syncing membership.

## Helpers
- `isGroupLeader(groupId)`
- `canManageGroup(groupId)`
- `hasGroupCourseAccess(courseId)` (RPC)
