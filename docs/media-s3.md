# Media — AWS S3 uploads

Course media is stored as **URL pointers in Postgres**. Binaries live in **AWS S3** (preferably behind CloudFront).

Related: [environments.md](./environments.md) · [cli-commands.md](./cli-commands.md)

---

## Architecture

```text
Author (Course Builder)
   ↓  POST /api/media/presign  (auth + canManageCourse)
Next.js API
   ↓  AWS SDK CreatePresignedPut
S3 bucket
   ↓  Browser PUT file directly to S3
App saves publicUrl into:
   courses.thumbnail_url
   lessons.content <img src>
   (future: attachments)
```

Postgres never stores file bytes.

---

## Environment variables

Add to `.env.local` / Vercel (server-only except public base URL):

```ini
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=aigs-lms-media-staging
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
# CloudFront or public bucket base — no trailing slash
AWS_S3_PUBLIC_BASE_URL=https://d111111abcdef8.cloudfront.net
# Optional alias:
# AWS_CLOUDFRONT_URL=https://d111111abcdef8.cloudfront.net
# Optional TTL for presigned PUT (default 300)
# AWS_S3_PRESIGN_EXPIRES=300
```

If these are missing, the builder falls back to **paste URL** (current LearnDash-compatible behavior).

---

## Object key layout

```text
courses/{courseId}/thumbnail/{uuid}-{filename}
courses/{courseId}/lesson-image/{uuid}-{filename}
courses/{courseId}/promo/{uuid}-{filename}
courses/{courseId}/attachment/{uuid}-{filename}
```

---

## Bucket recommendations

### Local / staging (simpler)

- Bucket for staging only
- Objects readable via CloudFront or public-read ACL / bucket policy for `GetObject`
- CORS allow `PUT` from `http://localhost:3000` and staging origin

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

### Production (paid content)

- **Private** bucket
- CloudFront in front with OAC
- Short-lived **signed GET** URLs for lesson assets (follow-up work)
- Separate staging vs production buckets

IAM user/role needs at least `s3:PutObject` (and `s3:GetObject` if using signed GET later) on the media prefix.

---

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/media/status` | `{ configured: boolean }` for UI |
| `POST` | `/api/media/presign` | Returns `{ uploadUrl, publicUrl, key, headers }` |

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

Authorization: logged-in user who `canManageCourse(courseId)`.

---

## UI wiring

- **Lesson TipTap** — image button uploads when `courseId` is set; otherwise prompts for URL
- **Course settings → Media** — thumbnail upload + URL field
- Promo **video** remains a URL (YouTube / Vimeo / S3+CloudFront MP4 link)

---

## LearnDash migration

Importer still stores WordPress media URLs. Later:

1. Sync `wp-content/uploads` → S3  
2. Rewrite `thumbnail_url` / HTML `src` to `AWS_S3_PUBLIC_BASE_URL`  
3. Keep old WP host only as temporary fallback  

---

## Security notes

- Never put `AWS_SECRET_ACCESS_KEY` in `NEXT_PUBLIC_*`
- Never upload via service-role paths from the browser
- Validate MIME + size server-side (`features/media/schema.ts`)
- Do not store card data or PII in object keys
