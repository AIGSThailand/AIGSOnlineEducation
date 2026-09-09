# Media — AWS S3 uploads

Course media is stored as **URL pointers in Postgres**. Binaries live in **AWS S3**.

Related: [environments.md](./environments.md) · [cli-commands.md](./cli-commands.md)

---

## Architecture

```text
Author (Course Builder)
   ↓  POST /api/media/presign  (auth + canManageCourse)
Next.js API → S3 presigned PUT
Browser uploads file → S3
App saves stable URL into courses.thumbnail_url / lessons.content

Student (private mode)
   ↓  <img src="/api/media/file?key=courses/...">
GET /api/media/file
   ↓  authorizeMediaRead (canAccessCourse for lesson assets)
   ↓  S3 presigned GET (short TTL)
302 → temporary S3 URL
```

Postgres never stores file bytes. **Never persist long-lived signed GET URLs** in the database.

---

## Access modes

| `AWS_S3_MEDIA_ACCESS` | Bucket | Stored URL | Read path |
|-----------------------|--------|------------|-----------|
| `public` (default) | Public CDN / bucket policy | `https://cdn.../courses/...` | Direct |
| `private` | **Private** bucket | `/api/media/file?key=courses/...` | Auth → signed GET |

For **paid / enrolled content**, use **`private`**. Students cannot usefully share a forever-valid object URL.

### Authorization (`GET /api/media/file`)

| Kind | Who can read |
|------|----------------|
| `lesson-image`, `attachment` | `canAccessCourse` or `canManageCourse` |
| `thumbnail`, `promo` | Published course **or** `canAccessCourse` / `canManageCourse` |

---

## Environment variables

```ini
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=aigs-lms-media-staging
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# public | private — use private for production paid media
AWS_S3_MEDIA_ACCESS=private

# Required only when AWS_S3_MEDIA_ACCESS=public
# AWS_S3_PUBLIC_BASE_URL=https://d111111abcdef8.cloudfront.net
# AWS_CLOUDFRONT_URL=https://d111111abcdef8.cloudfront.net

# Upload PUT TTL (default 300)
# AWS_S3_PRESIGN_EXPIRES=300
# Download GET TTL when private (default 60 — keep short)
# AWS_S3_SIGNED_GET_EXPIRES=60
```

If AWS vars are missing, the builder falls back to **paste URL**.

---

## Object key layout

```text
courses/{courseId}/thumbnail/{uuid}-{filename}
courses/{courseId}/lesson-image/{uuid}-{filename}
courses/{courseId}/promo/{uuid}-{filename}
courses/{courseId}/attachment/{uuid}-{filename}
```

Keys are validated strictly before signing; path traversal is rejected.

---

## Bucket recommendations

### Private (production paid content) — recommended

1. Block public access on the bucket (Block Public Access ON)
2. No public `GetObject` bucket policy
3. IAM for the app: `s3:PutObject`, `s3:GetObject` on `courses/*`
4. CORS allow `PUT` (and optionally `GET`/`HEAD`) from your app origins
5. Set `AWS_S3_MEDIA_ACCESS=private`

Example CORS:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "https://staging.your-domain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### Public (local / early staging only)

- CloudFront or public-read for `GetObject`
- `AWS_S3_MEDIA_ACCESS=public` + `AWS_S3_PUBLIC_BASE_URL`
- Fine for prototypes; **not** safe for paid lesson assets

### CloudFront signed URLs (optional later)

Same app flow: `/api/media/file` authorizes, then return a **CloudFront signed URL** instead of an S3 signed URL. OAC keeps the origin private. Not required for the first private-bucket rollout.

---

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/media/status` | `{ configured, access }` |
| `POST` | `/api/media/presign` | Presigned **PUT** for builders |
| `GET` | `/api/media/file?key=` | Auth + 302 to signed **GET** (or CDN) |
| `GET` | `/api/media/file?key=&redirect=0` | JSON `{ downloadUrl, expiresIn }` |

Presign body:

```json
{
  "courseId": "uuid",
  "kind": "thumbnail" | "lesson-image" | "promo" | "attachment",
  "fileName": "cover.png",
  "contentType": "image/png",
  "fileSize": 12345
}
```

Presign authorization: logged-in user who `canManageCourse(courseId)`.

---

## UI wiring

- **Lesson TipTap** — image button uploads when `courseId` is set; stores stable `publicUrl` (proxy path when private)
- **Course settings → Media** — thumbnail upload + URL field
- Promo **video** remains an embed URL (YouTube / Vimeo) unless you upload an MP4 as `attachment` later

---

## LearnDash migration

Importer still stores WordPress media URLs. Planned phases:

1. **Inventory (Phase 1)** — read-only scan of course/lesson URLs → JSON  
   `npm run inventory:media -- --env local`  
   Output default: `tmp/media-inventory-YYYY-MM-DD.json`
2. **Upload (Phase 2)** — download from a source host → private S3 (no DB rewrite)  
   `npm run migrate:media-s3 -- --host edu.aigsthailand.com --dry-run --limit 20`  
   `npm run migrate:media-s3 -- --host edu.aigsthailand.com --write --limit 20`  
   Skips WP `-WxH` resized files when a full sibling exists; **one object per course**.
3. **Rewrite (Phase 3)** — replace host URLs in Postgres with `/api/media/file?key=…`  
   `npm run rewrite:media-urls -- --env local --dry-run`  
   `npm run rewrite:media-urls -- --env local --write`  
   Leaves `source_content_html` unchanged; maps resized images to the full-size object.
4. Keep old WP host only as temporary fallback for unmapped URLs

Phases 1–2 do **not** rewrite the database. Phase 3 does (with `--write`).

---

## Security notes

- Never put `AWS_SECRET_ACCESS_KEY` in `NEXT_PUBLIC_*`
- Never upload via service-role paths from the browser
- Validate MIME + size server-side (`features/media/schema.ts`)
- Do not store card data or PII in object keys
- Signed GET TTL should stay short (`AWS_S3_SIGNED_GET_EXPIRES`, default 60s)
- Sharing a signed URL only works until TTL expires; the stable `/api/media/file` link still requires auth
