-- Extend wordpress_migration_map enums for user/enrollment migration (Phase 4).
-- `user` and `profile` already exist; add enrollment pair for access migration audit.

ALTER TYPE public.wordpress_migration_source_type ADD VALUE IF NOT EXISTS 'enrollment';
ALTER TYPE public.wordpress_migration_target_type ADD VALUE IF NOT EXISTS 'enrollment';
