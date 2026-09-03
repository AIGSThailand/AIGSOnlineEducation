# Media domain

AWS S3 uploads for course builder assets. Postgres stores **URLs only**.

## Entry points

| Path | Role |
|------|------|
| `lib/media/s3.ts` | Presign PUT + public URL |
| `app/api/media/presign/route.ts` | Authorized upload ticket |
| `app/api/media/status/route.ts` | Config probe for UI |
| `features/media/upload-client.ts` | Browser upload helper |
| `components/media/media-uploader.tsx` | Reusable upload button |

See [docs/media-s3.md](../../docs/media-s3.md).
