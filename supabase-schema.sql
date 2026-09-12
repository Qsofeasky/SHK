create extension if not exists pgcrypto;

create table if not exists public.membership_checks (
  id uuid primary key default gen_random_uuid(),
  check_type text not null check (check_type in ('status', 'bayaran', 'daftar')),
  member_name text not null,
  member_identifier text,
  phone text,
  email text,
  occupation text,
  address text,
  location_latitude numeric(10, 7),
  location_longitude numeric(10, 7),
  location_url text,
  kariah_confirmed boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.dependant_updates (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  member_identifier text not null,
  phone text,
  update_action text not null,
  dependant_total integer,
  new_phone text,
  new_ic text,
  new_address text,
  location_latitude numeric(10, 7),
  location_longitude numeric(10, 7),
  location_url text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.dependant_update_items (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.dependant_updates(id) on delete cascade,
  dependant_name text,
  dependant_ic text,
  gender text,
  age integer,
  relationship text,
  item_status text not null default 'Tambah',
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payer_name text not null,
  payer_identifier text,
  payment_method text not null check (payment_method in ('online', 'cash')),
  payment_year integer,
  amount numeric(10, 2),
  receipt_no text,
  receipt_proof_url text,
  receipt_proof_data text,
  receipt_proof_name text,
  bank_statement_ref text,
  apply_excess_to_next_year boolean not null default false,
  note text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  member_no text,
  member_name text,
  ic_no text,
  phone text,
  home_phone text,
  email text,
  occupation text,
  address text,
  dependant_count integer,
  membership_status text not null default 'aktif',
  left_kariah_note text,
  registration_year text,
  registration_member_amount numeric(10, 2),
  registration_dependant_amount numeric(10, 2),
  arrears_amount numeric(10, 2),
  source_sheet text,
  source_submission_id uuid,
  imported_at timestamptz not null default now()
);

create table if not exists public.member_yearly_payments (
  id uuid primary key default gen_random_uuid(),
  member_no text,
  member_name text,
  payment_year integer not null,
  amount numeric(10, 2),
  receipt_no text,
  source_sheet text,
  source_submission_id uuid,
  imported_at timestamptz not null default now()
);

create table if not exists public.member_dependants (
  id uuid primary key default gen_random_uuid(),
  member_no text,
  member_name text,
  position_no integer,
  dependant_name text,
  dependant_ic text,
  gender text,
  age integer,
  relationship text,
  source_sheet text,
  source_submission_id uuid,
  imported_at timestamptz not null default now()
);

create table if not exists public.inactive_members (
  id uuid primary key default gen_random_uuid(),
  member_no text,
  member_name text,
  phone text,
  address text,
  details text,
  source_sheet text,
  imported_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  email text primary key,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.non_member_donations (
  id uuid primary key default gen_random_uuid(),
  donor_name text not null,
  phone text,
  payment_method text not null check (payment_method in ('online', 'cash')),
  amount numeric(10, 2),
  receipt_no text,
  receipt_proof_url text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.kariah_exit_requests (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  member_identifier text,
  phone text,
  reason text,
  new_address text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_queue (
  id uuid primary key default gen_random_uuid(),
  reminder_type text not null check (reminder_type in ('user_unpaid', 'admin_pending', 'admin_backup', 'bank_statement_check')),
  recipient_email text,
  recipient_name text,
  subject text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.database_backups (
  id uuid primary key default gen_random_uuid(),
  backup_name text not null,
  backup_url text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('database-backups', 'database-backups', false)
on conflict (id) do nothing;

alter table public.members
add column if not exists source_submission_id uuid;

alter table public.members
add column if not exists membership_status text not null default 'aktif';

alter table public.members
add column if not exists left_kariah_note text;

alter table public.members
add column if not exists home_phone text;

alter table public.members
add column if not exists occupation text;

alter table public.members
add column if not exists email text;

alter table public.dependant_updates
add column if not exists phone text;

alter table public.dependant_updates
add column if not exists new_phone text;

alter table public.dependant_updates
add column if not exists new_ic text;

alter table public.dependant_updates
add column if not exists new_address text;

alter table public.dependant_updates
add column if not exists location_latitude numeric(10, 7);

alter table public.dependant_updates
add column if not exists location_longitude numeric(10, 7);

alter table public.dependant_updates
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

insert into public.admin_users (email, full_name)
values ('nurqistinasofea@graduate.utm.my', 'qistina')
on conflict (email) do update
set full_name = excluded.full_name;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.check_member_status(search_text text)
returns table (
  found boolean,
  status text,
  member_name text,
  member_no text,
  dependant_count integer
)
language sql
security definer
set search_path = public
as $$
  with query as (
    select lower(trim(coalesce(search_text, ''))) as q
  ),
  inactive_match as (
    select im.member_no, im.member_name
    from public.inactive_members im, query
    where query.q <> ''
      and (
        lower(coalesce(im.member_no, '')) = query.q
        or (
          length(regexp_replace(query.q, '[^0-9]', '', 'g')) >= 4
          and regexp_replace(coalesce(im.phone, ''), '[^0-9]', '', 'g') like '%' || regexp_replace(query.q, '[^0-9]', '', 'g') || '%'
        )
        or lower(coalesce(im.member_name, '')) like '%' || query.q || '%'
      )
    order by im.imported_at desc
    limit 1
  ),
  active_match as (
    select m.member_no, m.member_name, m.dependant_count
    from public.members m, query
    where query.q <> ''
      and (
        lower(coalesce(m.member_no, '')) = query.q
        or lower(coalesce(m.ic_no, '')) = query.q
        or (
          length(regexp_replace(query.q, '[^0-9]', '', 'g')) >= 4
          and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') like '%' || regexp_replace(query.q, '[^0-9]', '', 'g') || '%'
        )
        or lower(coalesce(m.member_name, '')) like '%' || query.q || '%'
      )
    order by m.imported_at desc
    limit 1
  )
  select
    true as found,
    'Tidak aktif / pindah / berhenti'::text as status,
    inactive_match.member_name,
    inactive_match.member_no,
    null::integer as dependant_count
  from inactive_match
  union all
  select
    true as found,
    'Aktif'::text as status,
    active_match.member_name,
    active_match.member_no,
    active_match.dependant_count
  from active_match
  where not exists (select 1 from inactive_match)
  union all
  select
    false as found,
    'Tidak dijumpai'::text as status,
    null::text as member_name,
    null::text as member_no,
    null::integer as dependant_count
  where not exists (select 1 from inactive_match)
    and not exists (select 1 from active_match)
  limit 1;
$$;

create or replace function public.check_payment_status(search_text text, payment_year_input integer default extract(year from now())::integer)
returns table (
  found boolean,
  status text,
  member_name text,
  member_no text,
  payment_year integer,
  amount numeric
)
language sql
security definer
set search_path = public
as $$
  with query as (
    select lower(trim(coalesce(search_text, ''))) as q
  ),
  member_match as (
    select m.member_no, m.member_name
    from public.members m, query
    where query.q <> ''
      and (
        lower(coalesce(m.member_no, '')) = query.q
        or lower(coalesce(m.ic_no, '')) = query.q
        or (
          length(regexp_replace(query.q, '[^0-9]', '', 'g')) >= 4
          and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') like '%' || regexp_replace(query.q, '[^0-9]', '', 'g') || '%'
        )
        or lower(coalesce(m.member_name, '')) like '%' || query.q || '%'
      )
    order by m.imported_at desc
    limit 1
  ),
  payment_match as (
    select p.member_no, p.member_name, p.payment_year, p.amount
    from public.member_yearly_payments p, member_match
    where p.payment_year = payment_year_input
      and (
        coalesce(p.member_no, '') = coalesce(member_match.member_no, '')
        or lower(coalesce(p.member_name, '')) = lower(coalesce(member_match.member_name, ''))
      )
    order by p.imported_at desc
    limit 1
  )
  select
    true as found,
    'Bayaran dijumpai'::text as status,
    coalesce(payment_match.member_name, member_match.member_name) as member_name,
    coalesce(payment_match.member_no, member_match.member_no) as member_no,
    payment_year_input as payment_year,
    payment_match.amount
  from member_match
  left join payment_match on true
  where exists (select 1 from payment_match)
  union all
  select
    true as found,
    'Belum ada rekod bayaran tahun ini'::text as status,
    member_match.member_name,
    member_match.member_no,
    payment_year_input as payment_year,
    null::numeric as amount
  from member_match
  where not exists (select 1 from payment_match)
  union all
  select
    false as found,
    'Ahli tidak dijumpai'::text as status,
    null::text as member_name,
    null::text as member_no,
    payment_year_input as payment_year,
    null::numeric as amount
  where not exists (select 1 from member_match)
  limit 1;
$$;

grant execute on function public.check_member_status(text) to anon, authenticated;
grant execute on function public.check_payment_status(text, integer) to anon, authenticated;

create or replace function public.check_payment_history(search_text text)
returns table (
  found boolean,
  status text,
  member_name text,
  member_no text,
  payment_year integer,
  amount numeric
)
language sql
security definer
set search_path = public
as $$
  with query as (
    select lower(trim(coalesce(search_text, ''))) as q
  ),
  member_match as (
    select m.member_no, m.member_name
    from public.members m, query
    where query.q <> ''
      and (
        lower(coalesce(m.member_no, '')) = query.q
        or lower(coalesce(m.ic_no, '')) = query.q
        or (
          length(regexp_replace(query.q, '[^0-9]', '', 'g')) >= 4
          and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') like '%' || regexp_replace(query.q, '[^0-9]', '', 'g') || '%'
        )
        or lower(coalesce(m.member_name, '')) like '%' || query.q || '%'
      )
    order by m.imported_at desc
    limit 1
  ),
  payments_found as (
    select
      coalesce(p.member_name, member_match.member_name) as member_name,
      coalesce(p.member_no, member_match.member_no) as member_no,
      p.payment_year,
      p.amount
    from public.member_yearly_payments p, member_match
    where (
      coalesce(p.member_no, '') = coalesce(member_match.member_no, '')
      or lower(coalesce(p.member_name, '')) = lower(coalesce(member_match.member_name, ''))
    )
  )
  select
    true as found,
    'Rekod bayaran dijumpai'::text as status,
    payments_found.member_name,
    payments_found.member_no,
    payments_found.payment_year,
    payments_found.amount
  from payments_found
  union all
  select
    true as found,
    'Ahli dijumpai tetapi belum ada rekod bayaran'::text as status,
    member_match.member_name,
    member_match.member_no,
    null::integer as payment_year,
    null::numeric as amount
  from member_match
  where not exists (select 1 from payments_found)
  union all
  select
    false as found,
    'Ahli tidak dijumpai'::text as status,
    null::text as member_name,
    null::text as member_no,
    null::integer as payment_year,
    null::numeric as amount
  where not exists (select 1 from member_match)
  order by payment_year desc nulls last;
$$;

grant execute on function public.check_payment_history(text) to anon, authenticated;

create or replace function public.check_receipt_status(receipt_search text)
returns table (
  found boolean,
  status text,
  payer_name text,
  payment_method text,
  payment_year integer,
  amount numeric,
  receipt_no text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with query as (
    select lower(trim(coalesce(receipt_search, ''))) as q
  ),
  receipt_match as (
    select *
    from (
      select
        p.payer_name,
        p.payment_method,
        p.payment_year,
        p.amount,
        p.receipt_no,
        p.status,
        p.created_at,
        1 as priority
      from public.payments p, query
      where query.q <> ''
        and lower(coalesce(p.receipt_no, '')) = query.q
      union all
      select
        d.donor_name as payer_name,
        d.payment_method,
        null::integer as payment_year,
        d.amount,
        d.receipt_no,
        d.status,
        d.created_at,
        2 as priority
      from public.non_member_donations d, query
      where query.q <> ''
        and lower(coalesce(d.receipt_no, '')) = query.q
    ) matched_receipts
    order by priority, created_at desc
    limit 1
  )
  select
    true as found,
    receipt_match.status,
    receipt_match.payer_name,
    receipt_match.payment_method,
    receipt_match.payment_year,
    receipt_match.amount,
    receipt_match.receipt_no,
    receipt_match.created_at
  from receipt_match
  union all
  select
    false as found,
    'Resit tidak dijumpai'::text as status,
    null::text as payer_name,
    null::text as payment_method,
    null::integer as payment_year,
    null::numeric as amount,
    null::text as receipt_no,
    null::timestamptz as created_at
  where not exists (select 1 from receipt_match)
  limit 1;
$$;

grant execute on function public.check_receipt_status(text) to anon, authenticated;

alter table public.membership_checks enable row level security;
alter table public.dependant_updates enable row level security;
alter table public.dependant_update_items enable row level security;
alter table public.payments enable row level security;
alter table public.members enable row level security;
alter table public.member_yearly_payments enable row level security;
alter table public.member_dependants enable row level security;
alter table public.inactive_members enable row level security;
alter table public.admin_users enable row level security;
alter table public.non_member_donations enable row level security;
alter table public.kariah_exit_requests enable row level security;
alter table public.reminder_queue enable row level security;
alter table public.database_backups enable row level security;

alter table public.members
add column if not exists source_submission_id uuid;

alter table public.members
add column if not exists membership_status text not null default 'aktif';

alter table public.members
add column if not exists left_kariah_note text;

alter table public.membership_checks
add column if not exists occupation text;

alter table public.membership_checks
add column if not exists email text;

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

drop policy if exists "Public can submit membership checks" on public.membership_checks;
create policy "Public can submit membership checks"
on public.membership_checks for insert
to anon
with check (kariah_confirmed = true);

drop policy if exists "Public can submit dependant updates" on public.dependant_updates;
create policy "Public can submit dependant updates"
on public.dependant_updates for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can submit dependant items" on public.dependant_update_items;
create policy "Public can submit dependant items"
on public.dependant_update_items for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can submit payments" on public.payments;
create policy "Public can submit payments"
on public.payments for insert
to anon
with check (true);

drop policy if exists "Public can submit non member donations" on public.non_member_donations;
create policy "Public can submit non member donations"
on public.non_member_donations for insert
to anon
with check (true);

drop policy if exists "Public can submit kariah exit requests" on public.kariah_exit_requests;

drop policy if exists "Public can queue admin reminders" on public.reminder_queue;
create policy "Public can queue admin reminders"
on public.reminder_queue for insert
to anon
with check (reminder_type = 'admin_pending');

drop policy if exists "Public can insert new members" on public.members;
drop policy if exists "Public can insert member dependants" on public.member_dependants;
drop policy if exists "Public can insert yearly payments" on public.member_yearly_payments;

drop policy if exists "Authenticated can manage membership checks" on public.membership_checks;
drop policy if exists "Admins can manage membership checks" on public.membership_checks;
create policy "Admins can manage membership checks"
on public.membership_checks for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated can manage dependant updates" on public.dependant_updates;
drop policy if exists "Admins can manage dependant updates" on public.dependant_updates;
create policy "Admins can manage dependant updates"
on public.dependant_updates for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated can manage dependant items" on public.dependant_update_items;
drop policy if exists "Admins can manage dependant items" on public.dependant_update_items;
create policy "Admins can manage dependant items"
on public.dependant_update_items for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated can manage payments" on public.payments;
drop policy if exists "Admins can manage payments" on public.payments;
create policy "Admins can manage payments"
on public.payments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated can manage members" on public.members;
drop policy if exists "Admins can manage members" on public.members;
create policy "Admins can manage members"
on public.members for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated can manage yearly payments" on public.member_yearly_payments;
drop policy if exists "Admins can manage yearly payments" on public.member_yearly_payments;
create policy "Admins can manage yearly payments"
on public.member_yearly_payments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated can manage member dependants" on public.member_dependants;
drop policy if exists "Admins can manage member dependants" on public.member_dependants;
create policy "Admins can manage member dependants"
on public.member_dependants for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated can manage inactive members" on public.inactive_members;
drop policy if exists "Admins can manage inactive members" on public.inactive_members;
create policy "Admins can manage inactive members"
on public.inactive_members for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage non member donations" on public.non_member_donations;
create policy "Admins can manage non member donations"
on public.non_member_donations for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage kariah exit requests" on public.kariah_exit_requests;
create policy "Admins can manage kariah exit requests"
on public.kariah_exit_requests for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage reminder queue" on public.reminder_queue;
create policy "Admins can manage reminder queue"
on public.reminder_queue for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can manage database backups" on public.database_backups;
create policy "Admins can manage database backups"
on public.database_backups for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can view admin users" on public.admin_users;
create policy "Admins can view admin users"
on public.admin_users for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can manage admin users" on public.admin_users;
create policy "Admins can manage admin users"
on public.admin_users for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create index if not exists membership_checks_created_at_idx on public.membership_checks (created_at desc);
create index if not exists dependant_updates_created_at_idx on public.dependant_updates (created_at desc);
create index if not exists payments_created_at_idx on public.payments (created_at desc);
create index if not exists members_member_no_idx on public.members (member_no);
create index if not exists members_member_name_idx on public.members (member_name);
create index if not exists member_yearly_payments_member_no_idx on public.member_yearly_payments (member_no);
create index if not exists member_dependants_member_no_idx on public.member_dependants (member_no);
create index if not exists inactive_members_member_no_idx on public.inactive_members (member_no);
create index if not exists members_source_submission_id_idx on public.members (source_submission_id);
create index if not exists member_yearly_payments_source_submission_id_idx on public.member_yearly_payments (source_submission_id);
create index if not exists member_dependants_source_submission_id_idx on public.member_dependants (source_submission_id);
create index if not exists payments_receipt_no_idx on public.payments (receipt_no);
create index if not exists non_member_donations_receipt_no_idx on public.non_member_donations (receipt_no);
create index if not exists reminder_queue_status_idx on public.reminder_queue (status, created_at desc);

create or replace function public.delete_member_from_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.members
  where source_submission_id = old.id
    and source_sheet = 'WEBSITE';

  return old;
end;
$$;

create or replace function public.delete_dependants_from_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.member_dependants
  where source_submission_id = old.id
    and source_sheet = 'WEBSITE';

  return old;
end;
$$;

create or replace function public.delete_payment_from_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.member_yearly_payments
  where source_submission_id = old.id
    and source_sheet like 'WEBSITE%';

  return old;
end;
$$;

drop trigger if exists delete_member_when_membership_check_deleted on public.membership_checks;
create trigger delete_member_when_membership_check_deleted
after delete on public.membership_checks
for each row
execute function public.delete_member_from_submission();

drop trigger if exists delete_dependants_when_update_deleted on public.dependant_updates;
create trigger delete_dependants_when_update_deleted
after delete on public.dependant_updates
for each row
execute function public.delete_dependants_from_submission();

drop trigger if exists delete_payment_when_payment_deleted on public.payments;
create trigger delete_payment_when_payment_deleted
after delete on public.payments
for each row
execute function public.delete_payment_from_submission();

drop view if exists public.pengguna_admin;
drop view if exists public.ahli_tidak_aktif;
drop view if exists public.rekod_backup_database;
drop view if exists public.senarai_reminder_email;
drop view if exists public.permohonan_keluar_kariah;
drop view if exists public.sumbangan_bukan_ahli;
drop view if exists public.bayaran_dihantar;
drop view if exists public.item_kemaskini_tanggungan;
drop view if exists public.kemaskini_tanggungan;
drop view if exists public.semakan_keahlian;
drop view if exists public.bayaran_tahunan_ahli;
drop view if exists public.tanggungan_ahli;
drop view if exists public.ahli;

create or replace view public.ahli with (security_invoker = true) as
select
  id,
  member_no as no_ahli,
  member_name as nama_ahli,
  ic_no as no_kad_pengenalan,
  phone as no_telefon,
  home_phone as no_telefon_rumah,
  email,
  occupation as pekerjaan,
  address as alamat,
  dependant_count as jumlah_tanggungan,
  registration_year as tahun_pendaftaran,
  registration_member_amount as yuran_ahli,
  registration_dependant_amount as yuran_tanggungan,
  arrears_amount as tunggakan,
  source_sheet as sumber_data,
  imported_at as tarikh_import
from public.members;

create or replace view public.tanggungan_ahli with (security_invoker = true) as
select
  id,
  member_no as no_ahli,
  member_name as nama_ahli,
  position_no as bilangan_tanggungan,
  dependant_name as nama_tanggungan,
  dependant_ic as no_ic_tanggungan,
  gender as jantina,
  age as umur,
  relationship as hubungan,
  source_sheet as sumber_data,
  imported_at as tarikh_import
from public.member_dependants;

create or replace view public.bayaran_tahunan_ahli with (security_invoker = true) as
select
  id,
  member_no as no_ahli,
  member_name as nama_ahli,
  payment_year as tahun_bayaran,
  amount as jumlah_bayaran,
  receipt_no as no_resit,
  source_sheet as sumber_data,
  imported_at as tarikh_import
from public.member_yearly_payments;

create or replace view public.semakan_keahlian with (security_invoker = true) as
select
  id,
  check_type as jenis_semakan,
  member_name as nama_ahli,
  member_identifier as no_ahli_atau_ic,
  phone as no_telefon,
  email,
  occupation as pekerjaan,
  address as alamat,
  location_latitude as lokasi_latitud,
  location_longitude as lokasi_longitud,
  location_url as link_lokasi_pemohon,
  status,
  created_at as tarikh_hantar
from public.membership_checks;

create or replace view public.kemaskini_tanggungan with (security_invoker = true) as
select
  id,
  member_name as nama_ahli,
  member_identifier as no_ahli_atau_ic,
  update_action as tujuan_kemaskini,
  dependant_total as jumlah_tanggungan_selepas_kemaskini,
  new_phone as no_telefon_baru,
  new_ic as no_ic_baru,
  new_address as alamat_baru,
  location_latitude as lokasi_latitud,
  location_longitude as lokasi_longitud,
  location_url as link_lokasi_baru,
  status,
  created_at as tarikh_hantar
from public.dependant_updates;

create or replace view public.item_kemaskini_tanggungan with (security_invoker = true) as
select
  id,
  update_id as id_kemaskini,
  dependant_name as nama_tanggungan,
  dependant_ic as no_ic_tanggungan,
  gender as jantina,
  age as umur,
  relationship as hubungan,
  item_status as status_item,
  created_at as tarikh_hantar
from public.dependant_update_items;

create or replace view public.bayaran_dihantar with (security_invoker = true) as
select
  id,
  payer_name as nama_pembayar,
  payer_identifier as no_ahli_ic_telefon,
  payment_method as kaedah_bayaran,
  payment_year as tahun_bayaran,
  amount as jumlah_bayaran,
  receipt_no as no_resit,
  receipt_proof_url as link_bukti_resit,
  receipt_proof_name as nama_fail_resit,
  receipt_proof_data as gambar_resit,
  bank_statement_ref as rujukan_bank_statement,
  apply_excess_to_next_year as lebihan_ke_tahun_depan,
  note as catatan,
  status,
  created_at as tarikh_hantar
from public.payments;

create or replace view public.sumbangan_bukan_ahli with (security_invoker = true) as
select
  id,
  donor_name as nama_penyumbang,
  phone as no_telefon,
  payment_method as kaedah_bayaran,
  amount as jumlah_sumbangan,
  receipt_no as no_resit,
  receipt_proof_url as link_bukti_sumbangan,
  note as catatan,
  status,
  created_at as tarikh_hantar
from public.non_member_donations;

create or replace view public.permohonan_keluar_kariah with (security_invoker = true) as
select
  id,
  member_name as nama_ahli,
  member_identifier as no_ahli_ic_telefon,
  phone as no_telefon,
  reason as sebab,
  new_address as alamat_baru,
  status,
  created_at as tarikh_hantar
from public.kariah_exit_requests;

create or replace view public.senarai_reminder_email with (security_invoker = true) as
select
  id,
  reminder_type as jenis_reminder,
  recipient_email as email_penerima,
  recipient_name as nama_penerima,
  subject as subjek,
  message as mesej,
  status,
  created_at as tarikh_dicipta,
  sent_at as tarikh_dihantar
from public.reminder_queue;

create or replace view public.rekod_backup_database with (security_invoker = true) as
select
  id,
  backup_name as nama_backup,
  backup_url as link_backup,
  notes as catatan,
  created_by as dibuat_oleh,
  created_at as tarikh_backup
from public.database_backups;

create or replace view public.ahli_tidak_aktif with (security_invoker = true) as
select
  id,
  member_no as no_ahli,
  member_name as nama_ahli,
  phone as no_telefon,
  address as alamat,
  details as butiran,
  source_sheet as sumber_data,
  imported_at as tarikh_import
from public.inactive_members;

create or replace view public.pengguna_admin with (security_invoker = true) as
select
  email,
  full_name as nama_penuh,
  created_at as tarikh_daftar
from public.admin_users;

