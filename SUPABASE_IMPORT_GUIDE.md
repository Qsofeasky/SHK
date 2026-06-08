# Supabase Import Guide

## 1. Create / Update Tables

Open Supabase Dashboard, then go to:

SQL Editor -> New query

Paste and run all SQL from:

`supabase-schema.sql`

This creates the website submission tables and the Excel import tables.

## 2. Import Excel Data

The Excel file has already been converted into CSV files inside:

`supabase-import/`

Import each CSV into the matching Supabase table:

| CSV file | Supabase table |
| --- | --- |
| `members.csv` | `members` |
| `member_dependants.csv` | `member_dependants` |
| `member_yearly_payments.csv` | `member_yearly_payments` |
| `inactive_members.csv` | `inactive_members` |

In Supabase:

1. Go to Table Editor.
2. Open the matching table.
3. Click Insert.
4. Choose Import data from CSV.
5. Upload the CSV file.
6. Confirm the column mapping.
7. Import.

## 3. Delete Wrong Data

To delete a wrong row:

1. Go to Table Editor.
2. Open the table.
3. Tick the checkbox beside the wrong row.
4. Click Delete.
5. Confirm Delete.

For safety, prefer editing the row first if it is only a spelling, phone, amount, or status mistake.

## 4. Website Submission Tables

New website form submissions go into:

- `membership_checks`
- `dependant_updates`
- `dependant_update_items`
- `payments`

Excel-imported existing records go into:

- `members`
- `member_dependants`
- `member_yearly_payments`
- `inactive_members`
