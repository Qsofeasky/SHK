# Admin Approval Guide

## 1. Run Updated SQL

Go to Supabase:

SQL Editor -> New query

Paste and run all SQL from:

`supabase-schema.sql`

This adds the login-user policies needed by the admin page.

## 2. Create AJK Login User

Go to Supabase:

Authentication -> Users -> Add user

Create an email and password for the AJK/admin user.

Then add the same email into the admin table. Go to:

SQL Editor -> New query

Run this, changing the email/name:

```sql
insert into public.admin_users (email, full_name)
values ('ajk-email@example.com', 'Nama AJK')
on conflict (email) do update
set full_name = excluded.full_name;
```

Use this email and password to login at:

`admin.html`

## 3. How Approval Works

Pending website forms stay in these tables:

- `membership_checks`
- `dependant_updates`
- `dependant_update_items`
- `payments`

When AJK approves:

- Daftar ahli baru copies into `members`.
- Tanggungan update copies into or removes from `member_dependants`.
- Bayaran verified copies into `member_yearly_payments`.

Rejected rows stay in the submission tables with status `rejected`.

## 4. Delete-Sync

Approved website records are linked using `source_submission_id`.

If an admin deletes a website submission row:

- Deleting from `membership_checks` also deletes the linked website-created row in `members`.
- Deleting from `dependant_updates` also deletes linked website-created rows in `member_dependants`.
- Deleting from `payments` also deletes the linked website-created row in `member_yearly_payments`.

This only applies to records approved after the latest SQL and admin code are used. Older approved records without `source_submission_id` must be deleted manually.

## 5. Important

Only emails listed in `admin_users` can approve, reject, insert, update, and delete records.

Public website visitors can only submit forms. They cannot read the member list, IC, phone number, address, payment history, or tanggungan data.
