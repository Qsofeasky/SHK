# Edge Functions Guide

Use these functions after the normal website and SQL update is done.

## Email Reminder

Function folder:

`supabase/functions/send-reminders`

This sends pending rows from `reminder_queue` using Resend.

Required Supabase secrets:

```text
SHK_SERVICE_ROLE_KEY
RESEND_API_KEY
MAIL_FROM
BACKUP_CRON_SECRET
REMINDER_CRON_SECRET
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided by Supabase automatically.

`MAIL_FROM` should use a verified sender/domain in Resend.

## Database Backup

Function folder:

`supabase/functions/database-backup`

This exports important SHK tables into one JSON file inside Supabase Storage bucket `database-backups`, then records it in `database_backups`.

## Deploy

Install Supabase CLI, login, link the project, then run:

```bash
supabase functions deploy send-reminders
supabase functions deploy database-backup
```

Set secrets before using the buttons:

```bash
supabase secrets set RESEND_API_KEY=your_resend_key
supabase secrets set SHK_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set MAIL_FROM="Surau Hj Kamaruddin <your_verified_email@yourdomain.com>"
supabase secrets set BACKUP_CRON_SECRET=choose_a_long_random_password
supabase secrets set REMINDER_CRON_SECRET=choose_a_different_long_random_password
```

After deploy, admin can use:

- `Send Queued Email`
- `Run Backup Auto`

For fully automatic schedule, edit and run:

`supabase-import/schedule_email_and_backup.sql`

For backup only, edit and run:

`supabase-import/schedule_monthly_backup_only.sql`

Replace these placeholders first:

- `YOUR_SUPABASE_ANON_KEY`
- `YOUR_BACKUP_CRON_SECRET`
- `YOUR_REMINDER_CRON_SECRET`

Default schedule:

- `send-reminders`: daily at 9:00
- `database-backup`: monthly on day 1 at 2:00
