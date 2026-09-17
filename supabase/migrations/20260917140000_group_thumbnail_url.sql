-- Bundle/group catalog thumbnails (same role as courses.thumbnail_url).
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN public.groups.thumbnail_url IS
  'Optional catalog thumbnail URL (CDN or /api/media/file?key=groups/{id}/thumbnail/…).';
