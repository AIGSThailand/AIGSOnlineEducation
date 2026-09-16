# Certificates domain

Template, eligibility rules, and earned certificates.

## Tables

- `certificate_templates`
- `certificate_rules`
- `earned_certificates`

## Design

Certificates are not a URL on `courses`. Eligibility is rule-driven with typed source FKs.

## v1

- Course rules only (quiz/group later)
- Auto-issue on 100% course step completion
- PDF via pdfkit over template background (default `public/certificates/aigs-online-template.jpg`, or per-template `backgroundImageUrl` in `template_data`) → S3 (`pdf_url`)
- CJK (e.g. Chinese course titles): Noto Sans SC for ideographs; Latin runs keep Helvetica/Trirong
- Admin layout form: background upload/URL (S3 `certificates/templates/{templateId}/…`), font sizes, vertical %, fonts; live preview; regenerate PDFs
- Public verify at `/verify/[code]`
