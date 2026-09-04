# Media domain

AWS S3 uploads for course builder assets. Postgres stores **stable URLs only**.

## Entry points

| Path | Role |
|------|------|
| `lib/media/s3.ts` | Presign PUT/GET + key parse |
| `features/media/access.ts` | Read authorization |
| `app/api/media/presign/route.ts` | Builder upload ticket |
| `app/api/media/file/route.ts` | Auth → short-lived GET (private) |
| `app/api/media/status/route.ts` | Config probe for UI |
| `features/media/upload-client.ts` | Browser upload helper |
| `components/media/media-uploader.tsx` | Reusable upload button |

Set `AWS_S3_MEDIA_ACCESS=private` for paid content. See [docs/media-s3.md](../../docs/media-s3.md).
