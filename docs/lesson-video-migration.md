# Lesson primary video migration (Phase 1)

Phase 1 delivers the Coursera-style learning workspace and instructor upload for the **primary** lesson video (`lessons.video_url` + related metadata). It does **not** automatically strip or rewrite HTML.

## Inventory (dry-run)

```bash
npm run inventory:lesson-videos
npm run inventory:lesson-videos -- --env staging
npm run inventory:lesson-videos -- --course <uuid> --out tmp/lesson-video-inventory.json
```

The report classifies lessons:

| Classification | Meaning | Action |
| --- | --- | --- |
| `primary_ready` | `video_url` already set | No promote needed; HTML embeds may still exist |
| `promote_candidate` | No `video_url`, exactly one unambiguous `<video>` / provider iframe | Instructor may copy proposed URL into Primary video |
| `multi_video_review` | Multiple playable embeds | Manual review — do not auto-pick |
| `html_only_links` | Only `.mp4` links, no embed | Optional promote after instructor check |
| `no_video` | Nothing found | Omitted from JSON `lessons` array |

## Rules

1. Prefer promoting into Primary video **before** removing HTML embeds, so learners never lose playback.
2. Rollback for a mistaken promote: clear `video_url` (and related fields); original HTML remains untouched. Use the promote backup JSON if you applied in bulk.
3. Lessons with both `video_url` and HTML videos may show two players until instructors clean HTML — inventory flags `primary_ready` with hits for visibility.
4. Never auto-promote `multi_video_review` lessons.

## Promote `promote_candidate` (optional)

Dry-run (default) reads an inventory file and reports what would be written. `--apply` sets `video_url` + `video_provider` only when `video_url` is still null. HTML is never modified.

```bash
# Dry-run from inventory
npm run promote:lesson-videos -- --from tmp/lesson-video-inventory.json

# Apply on local / staging
npm run promote:lesson-videos -- --from tmp/lesson-video-inventory.json --apply
npm run promote:lesson-videos -- --env staging --from tmp/lesson-video-inventory.json --apply

# Production (explicit gate)
npm run promote:lesson-videos -- --env production --from tmp/….json --apply --allow-production-write
```

Outputs:
- `tmp/lesson-video-promote-dryrun-YYYY-MM-DD.json` or `…-apply-…`
- On apply: `tmp/lesson-video-promote-backup-YYYY-MM-DD.json` (previous `video_url` / `video_provider`)

## Later phases

- Saved playback position (separate from Mark complete)
- Timestamped / clickable transcripts from WebVTT cues
- Optional HTML cleanup after primary video is confirmed