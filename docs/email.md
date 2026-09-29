# Transactional email

Application mail (support tickets and admin SMTP tests) goes through `sendApplicationEmail` in `features/email/service.ts`.

Sign-in, invite, and password-reset messages stay on Supabase Auth. This system does not send those, and it does not send marketing or bulk mail.

## Setup

1. Apply `supabase/migrations/20260928000000_email_system.sql`.
2. Set `EMAIL_SECRETS_KEY` in the server environment. Use a different value for local, staging, and production. The browser never receives it.
3. Open **Admin → Email** and save SMTP for the current `APP_ENV` (`local`, `staging`, or `production`). Each environment has its own row, even when two apps share a database.
4. Set the support address under **Platform settings**. Ticket mail is skipped (and logged) when that address is empty.

The SMTP password is encrypted before it is stored. The admin form never reads it back. Leave the password field blank to keep the saved secret.

## Templates

Events:

| Key | When |
| --- | --- |
| `support.ticket_created` | A learner opens a support ticket |
| `email.test` | An admin clicks “Send test to me” |

Sends use the event key. Deleting a saved template restores the built-in default. Only documented `{{variables}}` are accepted. Values inserted into HTML are escaped.

A failed or skipped send is written to `email_logs` and does not roll back the ticket.

## Mailosaur (local and staging)

[Mailosaur](https://mailosaur.com/docs) captures mail so local and staging sends never reach a real inbox. Production keeps the real SMTP provider. This app does not send SMS, so a Mailosaur phone number is unused.

1. Create an inbox and copy its server id and API key.
2. Set `MAILOSAUR_API_KEY` and `MAILOSAUR_SERVER_ID` in `.env.local` or `.env.cli.staging`. Do not set them for production, and do not prefix them with `NEXT_PUBLIC_`.
3. In **Admin → Email**, save SMTP for that environment:
   - Host `smtp.mailosaur.net`
   - Port `2525`
   - Secure off (the connection upgrades with STARTTLS)
   - Username `SERVER_ID@mailosaur.net`
   - Password from the inbox **Connect** tab
4. Any address at `SERVER_ID.mailosaur.net` is captured, including the admin test send.
5. Run `npm run test:mailosaur-email` (or `-- --env staging`). It sends the built-in test template, waits for the message, and requests Gmail and Outlook previews when the account allows them. Otherwise open the message in Mailosaur and choose **Generate Email Previews**.

Supabase Auth mail is separate. To capture invite, confirmation, and password-reset messages, point the staging Supabase SMTP settings at the same inbox. Leave production Auth on the real provider.
