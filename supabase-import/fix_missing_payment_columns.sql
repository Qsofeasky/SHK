alter table public.payments
add column if not exists payer_identifier text;

alter table public.payments
add column if not exists payment_year integer;

alter table public.payments
add column if not exists receipt_no text;

alter table public.payments
add column if not exists receipt_proof_url text;

alter table public.payments
add column if not exists receipt_proof_data text;

alter table public.payments
add column if not exists receipt_proof_name text;

alter table public.payments
add column if not exists bank_statement_ref text;

alter table public.payments
add column if not exists apply_excess_to_next_year boolean not null default false;

alter table public.members
add column if not exists source_submission_id uuid;

alter table public.members
add column if not exists membership_status text not null default 'aktif';

alter table public.members
add column if not exists left_kariah_note text;

alter table public.members
add column if not exists occupation text;

alter table public.members
add column if not exists email text;

alter table public.membership_checks
add column if not exists location_latitude numeric(10, 7);

alter table public.membership_checks
add column if not exists location_longitude numeric(10, 7);

alter table public.membership_checks
add column if not exists location_url text;

alter table public.member_yearly_payments
add column if not exists source_submission_id uuid;

alter table public.member_dependants
add column if not exists source_submission_id uuid;

alter table public.dependant_update_items
add column if not exists gender text;

alter table public.dependant_update_items
add column if not exists age integer;

alter table public.member_dependants
add column if not exists gender text;

alter table public.member_dependants
add column if not exists age integer;

insert into storage.buckets (id, name, public)
values ('database-backups', 'database-backups', false)
on conflict (id) do nothing;
