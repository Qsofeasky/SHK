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
  residence_type text,
  ic_proof_data text,
  ic_proof_name text,
  ic_proof_url text,
  ic_proof_drive_file_id text,
  ic_proof_storage_path text,
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
  new_name text,
  new_phone text,
  new_ic text,
  new_address text,
  new_residence_type text,
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ic-proofs',
  'ic-proofs',
  false,
  700000,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
add column if not exists new_name text;

alter table public.dependant_updates
add column if not exists new_phone text;

alter table public.dependant_updates
add column if not exists new_ic text;

alter table public.dependant_updates
add column if not exists new_address text;

alter table public.dependant_updates
add column if not exists new_residence_type text;

alter table public.dependant_updates
add column if not exists location_latitude numeric(10, 7);

alter table public.dependant_updates
add column if not exists location_longitude numeric(10, 7);

alter table public.membership_checks
add column if not exists residence_type text;

alter table public.membership_checks
add column if not exists ic_proof_data text;

alter table public.membership_checks
add column if not exists ic_proof_name text;

alter table public.membership_checks
add column if not exists ic_proof_url text;

alter table public.membership_checks
add column if not exists ic_proof_drive_file_id text;

alter table public.membership_checks
add column if not exists ic_proof_storage_path text;

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

create or replace function public.check_member_dependants(search_text text)
returns table (
  dependant_name text,
  relationship text
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
  )
  select
    md.dependant_name,
    md.relationship
  from public.member_dependants md
  join member_match mm on (
    coalesce(md.member_no, '') = coalesce(mm.member_no, '')
    or lower(coalesce(md.member_name, '')) = lower(coalesce(mm.member_name, ''))
  )
  where coalesce(trim(md.dependant_name), '') <> ''
  order by md.position_no nulls last, md.dependant_name
  limit 100;
$$;

grant execute on function public.check_member_dependants(text) to anon, authenticated;

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
    select replace(lower(trim(coalesce(receipt_search, ''))), ' ', '') as q
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
        and replace(lower(coalesce(p.receipt_no, '')), ' ', '') = query.q
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
        and replace(lower(coalesce(d.receipt_no, '')), ' ', '') = query.q
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

create or replace function public.submit_payment_with_receipt(
  p_payer_name text,
  p_payer_identifier text,
  p_payment_method text,
  p_payment_year integer,
  p_amount numeric,
  p_bank_statement_ref text default null,
  p_apply_excess_to_next_year boolean default false,
  p_note text default null
)
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
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt_year integer := coalesce(p_payment_year, extract(year from now())::integer);
  next_number integer;
  official_receipt text;
  inserted_payment public.payments%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('shk_receipt_' || receipt_year::text));

  with receipt_numbers as (
    select (regexp_match(p.receipt_no, '^SHK\s*-\s*([0-9]{1,4})\/' || receipt_year::text || '$', 'i'))[1]::integer as receipt_number
    from public.payments p
    where p.receipt_no is not null
    union all
    select (regexp_match(myp.receipt_no, '^SHK\s*-\s*([0-9]{1,4})\/' || receipt_year::text || '$', 'i'))[1]::integer as receipt_number
    from public.member_yearly_payments myp
    where myp.receipt_no is not null
    union all
    select (regexp_match(d.receipt_no, '^SHK\s*-\s*([0-9]{1,4})\/' || receipt_year::text || '$', 'i'))[1]::integer as receipt_number
    from public.non_member_donations d
    where d.receipt_no is not null
  )
  select coalesce(max(receipt_number), 0) + 1
  into next_number
  from receipt_numbers
  where receipt_number is not null;

  official_receipt := 'SHK-' || lpad(next_number::text, 4, '0') || '/' || receipt_year::text;

  insert into public.payments (
    payer_name,
    payer_identifier,
    payment_method,
    payment_year,
    amount,
    receipt_no,
    receipt_proof_url,
    receipt_proof_data,
    receipt_proof_name,
    bank_statement_ref,
    apply_excess_to_next_year,
    note,
    status
  )
  values (
    p_payer_name,
    p_payer_identifier,
    p_payment_method,
    receipt_year,
    p_amount,
    official_receipt,
    null,
    null,
    null,
    p_bank_statement_ref,
    coalesce(p_apply_excess_to_next_year, false),
    p_note,
    'pending'
  )
  returning * into inserted_payment;

  return query
  select
    true,
    inserted_payment.status,
    inserted_payment.payer_name,
    inserted_payment.payment_method,
    inserted_payment.payment_year,
    inserted_payment.amount,
    inserted_payment.receipt_no,
    inserted_payment.created_at;
end;
$$;

grant execute on function public.submit_payment_with_receipt(text, text, text, integer, numeric, text, boolean, text) to anon, authenticated;

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

drop policy if exists "Public can read dependant updates after insert" on public.dependant_updates;
create policy "Public can read dependant updates after insert"
on public.dependant_updates for select
to anon, authenticated
using (true);

drop policy if exists "Public can submit dependant items" on public.dependant_update_items;
create policy "Public can submit dependant items"
on public.dependant_update_items for insert
to anon, authenticated
with check (true);

grant insert, select on public.dependant_updates to anon, authenticated;
grant insert on public.dependant_update_items to anon, authenticated;

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
  new_name as nama_baru,
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



-- SHK: carian maklumat terkini dan pautan rekod melalui ID ahli kekal.
BEGIN;
-- Existing access policies remain unchanged. Helpers are internal to triggers.
ALTER TABLE public.member_yearly_payments ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.members(id);
ALTER TABLE public.member_dependants ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.members(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.members(id);
CREATE INDEX IF NOT EXISTS yearly_payments_member_id_idx ON public.member_yearly_payments(member_id);
CREATE INDEX IF NOT EXISTS dependants_member_id_idx ON public.member_dependants(member_id);
CREATE INDEX IF NOT EXISTS payments_member_id_idx ON public.payments(member_id);

CREATE OR REPLACE FUNCTION public.shk_resolve_member_link(identifier text, supplied_name text)
RETURNS uuid LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE matches uuid[]; digits text := regexp_replace(coalesce(identifier,''),'[^0-9]','','g');
BEGIN
 IF nullif(trim(identifier),'') IS NOT NULL THEN
  SELECT array_agg(m.id) INTO matches FROM public.members m
  WHERE lower(trim(m.member_no))=lower(trim(identifier))
     OR lower(trim(m.ic_no))=lower(trim(identifier))
     OR lower(trim(m.phone))=lower(trim(identifier))
     OR (length(digits)>=7 AND (
       regexp_replace(coalesce(m.ic_no,''),'[^0-9]','','g')=digits
       OR regexp_replace(coalesce(m.phone,''),'[^0-9]','','g')=digits
       OR regexp_replace(coalesce(m.member_no,''),'[^0-9]','','g')=digits));
  IF cardinality(matches)=1 THEN RETURN matches[1]; END IF;
  IF cardinality(matches)>1 THEN RETURN NULL; END IF;
 END IF;
 IF nullif(trim(supplied_name),'') IS NOT NULL THEN
  SELECT array_agg(m.id) INTO matches FROM public.members m
  WHERE lower(trim(m.member_name))=lower(trim(supplied_name));
  IF cardinality(matches)=1 THEN RETURN matches[1]; END IF;
 END IF;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.shk_resolve_member_link(text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.shk_attach_member_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.member_id IS NULL THEN
  IF TG_TABLE_NAME='payments' THEN
   NEW.member_id := public.shk_resolve_member_link(NEW.payer_identifier,NEW.payer_name);
  ELSE
   NEW.member_id := public.shk_resolve_member_link(NEW.member_no,NEW.member_name);
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.shk_attach_member_link() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS shk_attach_member_link ON public.member_yearly_payments;
CREATE TRIGGER shk_attach_member_link BEFORE INSERT OR UPDATE ON public.member_yearly_payments FOR EACH ROW EXECUTE FUNCTION public.shk_attach_member_link();
DROP TRIGGER IF EXISTS shk_attach_member_link ON public.member_dependants;
CREATE TRIGGER shk_attach_member_link BEFORE INSERT OR UPDATE ON public.member_dependants FOR EACH ROW EXECUTE FUNCTION public.shk_attach_member_link();
DROP TRIGGER IF EXISTS shk_attach_member_link ON public.payments;
CREATE TRIGGER shk_attach_member_link BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.shk_attach_member_link();

-- Backfill only a unique match. No fuzzy matching and no matching blank identifiers.
UPDATE public.member_yearly_payments p SET member_id=public.shk_resolve_member_link(p.member_no,p.member_name) WHERE p.member_id IS NULL;
UPDATE public.member_dependants p SET member_id=public.shk_resolve_member_link(p.member_no,p.member_name) WHERE p.member_id IS NULL;
UPDATE public.payments p SET member_id=public.shk_resolve_member_link(p.payer_identifier,p.payer_name) WHERE p.member_id IS NULL;

CREATE OR REPLACE FUNCTION public.shk_link_before_member_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target_id uuid;
BEGIN
 target_id := CASE WHEN TG_OP='INSERT' THEN NEW.id ELSE OLD.id END;
 -- Resolve before an update, or immediately after a new member is inserted.
 UPDATE public.member_yearly_payments p SET member_id=target_id WHERE p.member_id IS NULL AND public.shk_resolve_member_link(p.member_no,p.member_name)=target_id;
 UPDATE public.member_dependants p SET member_id=target_id WHERE p.member_id IS NULL AND public.shk_resolve_member_link(p.member_no,p.member_name)=target_id;
 UPDATE public.payments p SET member_id=target_id WHERE p.member_id IS NULL AND public.shk_resolve_member_link(p.payer_identifier,p.payer_name)=target_id;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.shk_link_before_member_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS shk_link_before_member_change ON public.members;
CREATE TRIGGER shk_link_before_member_change BEFORE UPDATE OF member_name,member_no,ic_no,phone ON public.members FOR EACH ROW EXECUTE FUNCTION public.shk_link_before_member_change();

DROP TRIGGER IF EXISTS shk_link_after_member_insert ON public.members;
CREATE TRIGGER shk_link_after_member_insert AFTER INSERT ON public.members FOR EACH ROW EXECUTE FUNCTION public.shk_link_before_member_change();

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
        or (length(regexp_replace(query.q, '[^0-9]', '', 'g')) = 12
          and regexp_replace(coalesce(m.ic_no, ''), '[^0-9]', '', 'g') = regexp_replace(query.q, '[^0-9]', '', 'g'))
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
    select m.id, m.member_no, m.member_name
    from public.members m, query
    where query.q <> ''
      and (
        lower(coalesce(m.member_no, '')) = query.q
        or lower(coalesce(m.ic_no, '')) = query.q
        or (length(regexp_replace(query.q, '[^0-9]', '', 'g')) = 12
          and regexp_replace(coalesce(m.ic_no, ''), '[^0-9]', '', 'g') = regexp_replace(query.q, '[^0-9]', '', 'g'))
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
        p.member_id = member_match.id
      )
    order by p.imported_at desc
    limit 1
  )
  select
    true as found,
    'Bayaran dijumpai'::text as status,
    member_match.member_name as member_name,
    member_match.member_no as member_no,
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

create or replace function public.check_member_dependants(search_text text)
returns table (
  dependant_name text,
  relationship text
)
language sql
security definer
set search_path = public
as $$
  with query as (
    select lower(trim(coalesce(search_text, ''))) as q
  ),
  member_match as (
    select m.id, m.member_no, m.member_name
    from public.members m, query
    where query.q <> ''
      and (
        lower(coalesce(m.member_no, '')) = query.q
        or lower(coalesce(m.ic_no, '')) = query.q
        or (length(regexp_replace(query.q, '[^0-9]', '', 'g')) = 12
          and regexp_replace(coalesce(m.ic_no, ''), '[^0-9]', '', 'g') = regexp_replace(query.q, '[^0-9]', '', 'g'))
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
    md.dependant_name,
    md.relationship
  from public.member_dependants md
  join member_match mm on (
    md.member_id = mm.id
  )
  where coalesce(trim(md.dependant_name), '') <> ''
  order by md.position_no nulls last, md.dependant_name
  limit 100;
$$;

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
    select m.id, m.member_no, m.member_name
    from public.members m, query
    where query.q <> ''
      and (
        lower(coalesce(m.member_no, '')) = query.q
        or lower(coalesce(m.ic_no, '')) = query.q
        or (length(regexp_replace(query.q, '[^0-9]', '', 'g')) = 12
          and regexp_replace(coalesce(m.ic_no, ''), '[^0-9]', '', 'g') = regexp_replace(query.q, '[^0-9]', '', 'g'))
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
      member_match.member_name as member_name,
      member_match.member_no as member_no,
      p.payment_year,
      p.amount
    from public.member_yearly_payments p, member_match
    where (
      p.member_id = member_match.id
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
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Rekod lama yang tidak dapat dipadankan secara unik; perlu semakan admin.
SELECT id, member_name, payment_year FROM public.member_yearly_payments WHERE member_id IS NULL;


-- Atomic member updates and current dependant preview
BEGIN;
ALTER TABLE public.dependant_updates ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.members(id);
ALTER TABLE public.dependant_updates ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE public.dependant_update_items ADD COLUMN IF NOT EXISTS target_dependant_id uuid;
ALTER TABLE public.dependant_update_items ADD COLUMN IF NOT EXISTS applied_dependant_id uuid;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS residence_type text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS location_url text;
CREATE TABLE IF NOT EXISTS public.member_update_audit (
 update_id uuid PRIMARY KEY REFERENCES public.dependant_updates(id),
 member_id uuid NOT NULL REFERENCES public.members(id),
 before_member jsonb NOT NULL,
 before_dependants jsonb NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_update_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read member update audit" ON public.member_update_audit;
CREATE POLICY "Admins read member update audit" ON public.member_update_audit FOR SELECT TO authenticated USING (public.is_admin());
GRANT SELECT ON public.member_update_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.lookup_member_for_update(p_member_name text,p_identifier text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid uuid; m public.members%rowtype; matches integer;
BEGIN
 IF nullif(trim(p_identifier),'') IS NULL THEN RAISE EXCEPTION 'Masukkan telefon atau IC ahli.'; END IF;
 mid := public.shk_resolve_member_link(p_identifier,NULL);
 IF mid IS NULL THEN RAISE EXCEPTION 'Ahli tidak ditemui atau padanan berganda. Semak telefon/IC terkini.'; END IF;
 SELECT * INTO m FROM public.members WHERE id=mid;
 -- The typed name is a hint only. A unique phone/IC selects the member.

 IF m.membership_status<>'aktif' THEN RAISE EXCEPTION 'Rekod ahli tidak aktif. Hubungi pentadbir.'; END IF;
 RETURN jsonb_build_object('member_id',m.id,'member_name',m.member_name,'member_no',m.member_no,
  'dependants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'dependant_name',d.dependant_name,
    'masked_ic',CASE WHEN nullif(d.dependant_ic,'') IS NULL THEN '' ELSE '******' || right(d.dependant_ic,4) END,
    'gender',d.gender,'age',d.age,'relationship',d.relationship) ORDER BY d.position_no NULLS LAST,d.dependant_name)
    FROM public.member_dependants d WHERE d.member_id=m.id),'[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.lookup_member_for_update(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_member_for_update(text,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.approve_member_update(p_update_id uuid,p_repair boolean DEFAULT false,p_member_no text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u public.dependant_updates%rowtype; m public.members%rowtype; i public.dependant_update_items%rowtype;
 mid uuid; did uuid; matched integer; old_deps jsonb; change_count integer:=0; desired_count integer;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Akses pentadbir diperlukan.'; END IF;
 SELECT * INTO u FROM public.dependant_updates WHERE id=p_update_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Permohonan tidak ditemui.'; END IF;
 IF u.applied_at IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.member_update_audit a WHERE a.update_id=u.id) THEN RAISE EXCEPTION 'Penanda simpanan tiada rekod audit. Semak manual.'; END IF;
  RETURN jsonb_build_object('status','already_applied');
 END IF;
 IF u.status='approved' AND NOT p_repair THEN RAISE EXCEPTION 'Gunakan pemulihan untuk permohonan lama diluluskan.'; END IF;
 IF u.status NOT IN ('pending','reviewed','approved') THEN RAISE EXCEPTION 'Permohonan telah ditolak.'; END IF;
 IF nullif(trim(p_member_no),'') IS NOT NULL THEN
  IF NOT p_repair THEN RAISE EXCEPTION 'Padanan manual hanya untuk pemulihan.'; END IF;
  SELECT count(*),(array_agg(x.id))[1] INTO matched,mid FROM public.members x WHERE trim(x.member_no)=trim(p_member_no);
  IF matched<>1 THEN RAISE EXCEPTION 'Nombor ahli tidak sepadan secara unik.'; END IF;
 ELSE mid:=coalesce(u.member_id,public.shk_resolve_member_link(u.member_identifier,NULL)); END IF;
 IF mid IS NULL THEN RAISE EXCEPTION 'Tiada padanan telefon/IC yang unik. Pentadbir perlu sahkan ahli asal.'; END IF;
 SELECT * INTO m FROM public.members WHERE id=mid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rekod ahli tiada.'; END IF;
 IF m.membership_status<>'aktif' THEN RAISE EXCEPTION 'Ahli tidak aktif; semakan manual diperlukan.'; END IF;
 -- A newly submitted member_id is a hint, not authorization: require the identifier to match.
 IF NOT p_repair AND public.shk_resolve_member_link(u.member_identifier,NULL) IS DISTINCT FROM mid THEN
  RAISE EXCEPTION 'Telefon/IC ahli telah berubah. Semak semula sebelum meluluskan.';
 END IF;
 IF p_repair AND u.update_action='Kemaskini Maklumat Diri' AND EXISTS(
 SELECT 1 FROM public.dependant_updates later WHERE later.status='approved' AND later.update_action='Kemaskini Maklumat Diri'
 AND later.created_at>u.created_at AND coalesce(later.member_id,public.shk_resolve_member_link(later.member_identifier,NULL))=mid
 ) THEN RAISE EXCEPTION 'Ada kemaskini diri lebih baharu. Semak sejarah; jangan ulang permohonan lama.'; END IF;
 IF p_repair AND u.update_action<>'Kemaskini Maklumat Diri' AND EXISTS(
 SELECT 1 FROM public.dependant_updates later WHERE later.status='approved' AND later.update_action<>'Kemaskini Maklumat Diri'
 AND later.created_at>u.created_at AND (coalesce(later.member_id,public.shk_resolve_member_link(later.member_identifier,NULL))=mid OR lower(trim(later.member_name))=lower(trim(u.member_name)))
 ) THEN RAISE EXCEPTION 'Ada permohonan tanggungan lebih baharu. Semak sejarah sebelum pulihkan.'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) INTO old_deps FROM public.member_dependants d WHERE d.member_id=mid;
 INSERT INTO public.member_update_audit(update_id,member_id,before_member,before_dependants)
 VALUES(u.id,mid,to_jsonb(m),old_deps);
 IF u.update_action='Kemaskini Maklumat Diri' THEN
  IF coalesce(nullif(trim(u.new_name),''),nullif(trim(u.new_phone),''),nullif(trim(u.new_ic),''),nullif(trim(u.new_address),''),nullif(trim(u.new_residence_type),'')) IS NULL THEN
   RAISE EXCEPTION 'Tiada maklumat baharu untuk disimpan.';
  END IF;
  IF nullif(trim(u.new_phone),'') IS NOT NULL AND EXISTS(SELECT 1 FROM public.members x WHERE x.id<>mid AND regexp_replace(coalesce(x.phone,''),'[^0-9]','','g')=regexp_replace(u.new_phone,'[^0-9]','','g')) THEN
   RAISE EXCEPTION 'Telefon baharu digunakan oleh ahli lain; semak manual.';
  END IF;
  IF nullif(trim(u.new_ic),'') IS NOT NULL AND EXISTS(SELECT 1 FROM public.members x WHERE x.id<>mid AND regexp_replace(coalesce(x.ic_no,''),'[^0-9]','','g')=regexp_replace(u.new_ic,'[^0-9]','','g')) THEN
   RAISE EXCEPTION 'IC baharu digunakan oleh ahli lain; semak manual.';
  END IF;
  UPDATE public.members SET member_name=coalesce(nullif(trim(u.new_name),''),member_name),
    phone=coalesce(nullif(trim(u.new_phone),''),phone),ic_no=coalesce(nullif(trim(u.new_ic),''),ic_no),
    address=coalesce(nullif(trim(u.new_address),''),address),residence_type=coalesce(nullif(trim(u.new_residence_type),''),residence_type),
    location_url=coalesce(nullif(trim(u.location_url),''),location_url) WHERE id=mid;
 ELSE
  IF u.update_action NOT IN ('Tambah Tanggungan','Kurangkan Tanggungan','Kemaskini Maklumat Tanggungan') THEN RAISE EXCEPTION 'Jenis permohonan tidak sah.'; END IF;
  FOR i IN SELECT * FROM public.dependant_update_items WHERE update_id=u.id ORDER BY created_at,id LOOP
   did:=NULL;
   IF i.item_status NOT IN ('Tambah','Buang','Kemaskini') THEN RAISE EXCEPTION 'Status tanggungan tidak sah.'; END IF;
   IF i.item_status='Tambah' THEN
    IF nullif(trim(i.dependant_name),'') IS NULL THEN RAISE EXCEPTION 'Nama tanggungan diperlukan.'; END IF;
    -- Recover an old insert only when it is already linked to this same submission.
    SELECT count(*),(array_agg(d.id))[1] INTO matched,did FROM public.member_dependants d WHERE d.member_id=mid AND d.source_submission_id=u.id
      AND lower(trim(d.dependant_name))=lower(trim(i.dependant_name))
      AND coalesce(d.dependant_ic,'')=coalesce(i.dependant_ic,'');
    IF matched>1 THEN RAISE EXCEPTION 'Rekod tanggungan berganda; semak manual.'; END IF;
    IF matched=0 THEN
     IF nullif(trim(i.dependant_ic),'') IS NOT NULL AND EXISTS(SELECT 1 FROM public.member_dependants d WHERE d.member_id=mid AND regexp_replace(d.dependant_ic,'[^0-9A-Za-z]','','g')=regexp_replace(i.dependant_ic,'[^0-9A-Za-z]','','g')) THEN
      RAISE EXCEPTION 'IC tanggungan sudah wujud; gunakan kemaskini, bukan tambah.';
     END IF;
     INSERT INTO public.member_dependants(member_id,member_no,member_name,dependant_name,dependant_ic,gender,age,relationship,source_sheet,source_submission_id)
     VALUES(mid,m.member_no,m.member_name,i.dependant_name,i.dependant_ic,i.gender,i.age,i.relationship,'WEBSITE',u.id) RETURNING id INTO did;
    END IF;
   ELSE
    IF i.target_dependant_id IS NOT NULL THEN
     SELECT d.id INTO did FROM public.member_dependants d WHERE d.id=i.target_dependant_id AND d.member_id=mid FOR UPDATE;
    ELSE
     SELECT count(*),(array_agg(d.id))[1] INTO matched,did FROM public.member_dependants d WHERE d.member_id=mid AND (
      (nullif(trim(i.dependant_ic),'') IS NOT NULL AND regexp_replace(d.dependant_ic,'[^0-9A-Za-z]','','g')=regexp_replace(i.dependant_ic,'[^0-9A-Za-z]','','g'))
      OR (nullif(trim(i.dependant_ic),'') IS NULL AND lower(trim(d.dependant_name))=lower(trim(i.dependant_name))));
     IF matched<>1 THEN RAISE EXCEPTION 'Tanggungan lama tidak dapat dipadankan secara unik. Semak manual.'; END IF;
    END IF;
    IF did IS NULL THEN RAISE EXCEPTION 'Tanggungan tidak lagi wujud atau bukan milik ahli ini.'; END IF;
    IF i.item_status='Buang' THEN DELETE FROM public.member_dependants WHERE id=did AND member_id=mid;
    ELSE
     UPDATE public.member_dependants SET dependant_name=coalesce(nullif(trim(i.dependant_name),''),dependant_name),
      dependant_ic=coalesce(nullif(trim(i.dependant_ic),''),dependant_ic),gender=coalesce(nullif(i.gender,''),gender),
      age=coalesce(i.age,age),relationship=coalesce(nullif(trim(i.relationship),''),relationship) WHERE id=did AND member_id=mid;
    END IF;
   END IF;
   IF i.item_status='Buang' THEN
    IF EXISTS(SELECT 1 FROM public.member_dependants d WHERE d.id=did) THEN RAISE EXCEPTION 'Pembuangan tanggungan tidak disimpan. Kelulusan dibatalkan.'; END IF;
   ELSE
    IF NOT EXISTS(SELECT 1 FROM public.member_dependants d WHERE d.id=did AND d.member_id=mid
     AND (nullif(trim(i.dependant_name),'') IS NULL OR trim(d.dependant_name) IS NOT DISTINCT FROM trim(i.dependant_name))
     AND (nullif(trim(i.dependant_ic),'') IS NULL OR trim(d.dependant_ic) IS NOT DISTINCT FROM trim(i.dependant_ic))
     AND (nullif(trim(i.gender),'') IS NULL OR d.gender IS NOT DISTINCT FROM i.gender)
     AND (i.age IS NULL OR d.age IS NOT DISTINCT FROM i.age)
     AND (nullif(trim(i.relationship),'') IS NULL OR trim(d.relationship) IS NOT DISTINCT FROM trim(i.relationship))) THEN
     RAISE EXCEPTION 'Maklumat tanggungan tersimpan tidak sepadan dengan permohonan. Kelulusan dibatalkan.';
    END IF;
   END IF;
   UPDATE public.dependant_update_items SET applied_dependant_id=did WHERE id=i.id;
   change_count:=change_count+1;
  END LOOP;
  IF change_count=0 THEN RAISE EXCEPTION 'Tiada baris tanggungan untuk dikemaskini.'; END IF;
  SELECT count(*) INTO desired_count FROM public.member_dependants WHERE member_id=mid;
  UPDATE public.members SET dependant_count=desired_count WHERE id=mid;
  IF NOT EXISTS(SELECT 1 FROM public.members x WHERE x.id=mid AND x.dependant_count=desired_count) THEN
   RAISE EXCEPTION 'Jumlah tanggungan tidak berjaya disimpan. Kelulusan dibatalkan.';
  END IF;
 END IF;
 IF u.update_action='Kemaskini Maklumat Diri' AND NOT EXISTS(SELECT 1 FROM public.members x WHERE x.id=mid
  AND (nullif(trim(u.new_name),'') IS NULL OR trim(x.member_name) IS NOT DISTINCT FROM trim(u.new_name))
  AND (nullif(trim(u.new_phone),'') IS NULL OR trim(x.phone) IS NOT DISTINCT FROM trim(u.new_phone))
  AND (nullif(trim(u.new_ic),'') IS NULL OR trim(x.ic_no) IS NOT DISTINCT FROM trim(u.new_ic))
  AND (nullif(trim(u.new_address),'') IS NULL OR trim(x.address) IS NOT DISTINCT FROM trim(u.new_address))
  AND (nullif(trim(u.new_residence_type),'') IS NULL OR x.residence_type IS NOT DISTINCT FROM u.new_residence_type)) THEN
  RAISE EXCEPTION 'Maklumat ahli tersimpan tidak sepadan. Kelulusan dibatalkan.';
 END IF;
 UPDATE public.dependant_updates SET member_id=mid,status='approved',applied_at=now() WHERE id=u.id;
 IF NOT EXISTS(SELECT 1 FROM public.dependant_updates x WHERE x.id=u.id AND x.status='approved' AND x.applied_at IS NOT NULL AND x.member_id=mid) THEN
  RAISE EXCEPTION 'Status simpanan gagal disahkan. Semua perubahan dibatalkan.';
 END IF;
 RETURN jsonb_build_object('status','applied','member_id',mid,'changed_items',change_count);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_member_update(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_member_update(uuid,boolean,text) TO authenticated;

-- SQL Editor batch repair: preserves failures as a report, never guesses by name alone.
CREATE OR REPLACE FUNCTION public.repair_approved_member_updates()
RETURNS TABLE(update_id uuid,member_name text,result text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u record; r jsonb; mid uuid;
BEGIN
 -- SQL Editor runs as postgres; web sessions still require an admin.
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Akses pentadbir diperlukan.'; END IF;
 FOR u IN SELECT d.* FROM public.dependant_updates d WHERE d.status='approved' AND d.applied_at IS NULL ORDER BY d.created_at,d.id LOOP
  update_id:=u.id;member_name:=u.member_name;
  BEGIN
   mid:=coalesce(u.member_id,public.shk_resolve_member_link(u.member_identifier,NULL));
   IF mid IS NULL THEN RAISE EXCEPTION 'Perlu padanan ahli manual: telefon/IC rujukan tidak ditemui.'; END IF;
   -- Do not replay an older self-update over a newer approved request for the same member.
   IF u.update_action='Kemaskini Maklumat Diri' AND EXISTS(
    SELECT 1 FROM public.dependant_updates later WHERE later.status='approved' AND later.update_action='Kemaskini Maklumat Diri'
    AND later.created_at>u.created_at AND coalesce(later.member_id,public.shk_resolve_member_link(later.member_identifier,NULL))=mid
   ) THEN result:='SKIP: ada kemaskini diri lebih baharu; semak manual'; RETURN NEXT; CONTINUE; END IF;
   -- Do not replay older dependant changes over a more recent approved request.
   IF u.update_action<>'Kemaskini Maklumat Diri' AND EXISTS(
    SELECT 1 FROM public.dependant_updates later WHERE later.status='approved' AND later.update_action<>'Kemaskini Maklumat Diri'
    AND later.created_at>u.created_at AND (coalesce(later.member_id,public.shk_resolve_member_link(later.member_identifier,NULL))=mid
      OR lower(trim(later.member_name))=lower(trim(u.member_name)))
   ) THEN result:='SKIP: ada kemaskini tanggungan lebih baharu; semak manual'; RETURN NEXT; CONTINUE; END IF;
   r:=public.approve_member_update(u.id,true);result:=r->>'status';
  EXCEPTION WHEN OTHERS THEN result:='SEMAK: '||SQLERRM;
  END;
  RETURN NEXT;
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.repair_approved_member_updates() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.repair_approved_member_updates() TO authenticated;
CREATE OR REPLACE FUNCTION public.shk_guard_update_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN
  NEW.status:='pending'; NEW.applied_at:=NULL;
  NEW.member_id:=public.shk_resolve_member_link(NEW.member_identifier,NULL);
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.shk_guard_update_submission() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS shk_guard_update_submission ON public.dependant_updates;
CREATE TRIGGER shk_guard_update_submission BEFORE INSERT ON public.dependant_updates FOR EACH ROW EXECUTE FUNCTION public.shk_guard_update_submission();

CREATE OR REPLACE FUNCTION public.shk_member_by_repair_phone(p_phone text)
RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE digits text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'); matches uuid[];
BEGIN
 IF digits LIKE '60%' THEN digits:='0'||substr(digits,3); END IF;
 IF digits NOT LIKE '01%' OR length(digits) NOT IN (10,11) THEN RAISE EXCEPTION 'Masukkan nombor telefon bimbit ahli yang sah.'; END IF;
 SELECT array_agg(m.id) INTO matches FROM public.members m
 WHERE CASE WHEN regexp_replace(coalesce(m.phone,''),'[^0-9]','','g') LIKE '60%'
 THEN '0'||substr(regexp_replace(m.phone,'[^0-9]','','g'),3)
 ELSE regexp_replace(coalesce(m.phone,''),'[^0-9]','','g') END=digits;
 IF coalesce(cardinality(matches),0)=0 THEN RAISE EXCEPTION 'Telefon tidak ditemui. Gunakan nombor telefon terkini dalam rekod ahli.'; END IF;
 IF cardinality(matches)<>1 THEN RAISE EXCEPTION 'Telefon dikongsi beberapa rekod ahli. Semakan manual diperlukan.'; END IF;
 RETURN matches[1];
END;
$$;
REVOKE ALL ON FUNCTION public.shk_member_by_repair_phone(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.lookup_repair_member_by_phone(p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid uuid; result jsonb;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Akses pentadbir diperlukan.'; END IF;
 mid:=public.shk_member_by_repair_phone(p_phone);
 SELECT jsonb_build_object('member_id',id,'member_name',member_name,'phone_last4',right(regexp_replace(phone,'[^0-9]','','g'),4)) INTO result FROM public.members WHERE id=mid;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.lookup_repair_member_by_phone(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lookup_repair_member_by_phone(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_member_update_by_phone(p_update_id uuid,p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid uuid; u public.dependant_updates%rowtype;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') AND NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Akses pentadbir diperlukan.'; END IF;
 SELECT * INTO u FROM public.dependant_updates WHERE id=p_update_id FOR UPDATE;
 IF NOT FOUND OR u.status<>'approved' THEN RAISE EXCEPTION 'Pemulihan ini hanya untuk permohonan lama yang diluluskan.'; END IF;
 mid:=public.shk_member_by_repair_phone(p_phone);
 PERFORM id FROM public.members WHERE id=mid FOR UPDATE;
 -- Recheck after locking, in case the member phone changed during confirmation.
 IF public.shk_member_by_repair_phone(p_phone) IS DISTINCT FROM mid THEN RAISE EXCEPTION 'Padanan telefon telah berubah. Semak semula.'; END IF;
 IF u.applied_at IS NOT NULL AND u.member_id IS DISTINCT FROM mid THEN RAISE EXCEPTION 'Permohonan sudah disimpan untuk ahli lain. Tidak boleh dipindahkan.'; END IF;
 UPDATE public.dependant_updates SET member_id=mid WHERE id=p_update_id AND applied_at IS NULL;
 RETURN public.approve_member_update(p_update_id,true,NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.repair_member_update_by_phone(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.repair_member_update_by_phone(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_member_update(p_payload jsonb,p_items jsonb DEFAULT '[]'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE identity jsonb; mid uuid; uid uuid:=gen_random_uuid(); item jsonb; action text:=p_payload->>'update_action'; expected_status text; target_id uuid; seen uuid[]:='{}';
BEGIN
 IF action NOT IN ('Kemaskini Maklumat Diri','Tambah Tanggungan','Kurangkan Tanggungan','Kemaskini Maklumat Tanggungan') OR action IS NULL THEN RAISE EXCEPTION 'Jenis permohonan tidak sah.'; END IF;
 IF action<>'Kemaskini Maklumat Diri' AND nullif(trim(p_payload->>'member_name'),'') IS NULL THEN RAISE EXCEPTION 'Nama ahli diperlukan.'; END IF;
 identity:=public.lookup_member_for_update(p_payload->>'member_name',p_payload->>'member_identifier');
 mid:=(identity->>'member_id')::uuid;
 IF jsonb_typeof(p_items)<>'array' OR p_items IS NULL THEN RAISE EXCEPTION 'Senarai tanggungan tidak sah.'; END IF;
 IF jsonb_array_length(p_items)>30 THEN RAISE EXCEPTION 'Maksimum 30 perubahan setiap permohonan.'; END IF;
 IF action<>'Kemaskini Maklumat Diri' AND jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Pilih sekurang-kurangnya satu tanggungan.'; END IF;
 IF action='Kemaskini Maklumat Diri' AND coalesce(nullif(trim(p_payload->>'new_name'),''),nullif(trim(p_payload->>'new_phone'),''),nullif(trim(p_payload->>'new_ic'),''),nullif(trim(p_payload->>'new_address'),''),nullif(trim(p_payload->>'new_residence_type'),'')) IS NULL THEN RAISE EXCEPTION 'Isi maklumat baharu dahulu.'; END IF;
 INSERT INTO public.dependant_updates(id,member_id,member_name,member_identifier,phone,update_action,new_name,new_phone,new_ic,new_address,new_residence_type,location_url)
 VALUES(uid,mid,identity->>'member_name',p_payload->>'member_identifier',p_payload->>'member_identifier',action,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'new_name'),'') END,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'new_phone'),'') END,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'new_ic'),'') END,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'new_address'),'') END,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'new_residence_type'),'') END,
 CASE WHEN action='Kemaskini Maklumat Diri' THEN nullif(trim(p_payload->>'location_url'),'') END);
 IF action<>'Kemaskini Maklumat Diri' THEN
 expected_status:=CASE action WHEN 'Tambah Tanggungan' THEN 'Tambah' WHEN 'Kurangkan Tanggungan' THEN 'Buang' ELSE 'Kemaskini' END;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  target_id:=nullif(item->>'target_dependant_id','')::uuid;
  IF expected_status<>'Tambah' THEN
   IF target_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.member_dependants d WHERE d.id=target_id AND d.member_id=mid) THEN RAISE EXCEPTION 'Pilih tanggungan terkini milik ahli ini.'; END IF;
   IF target_id=ANY(seen) THEN RAISE EXCEPTION 'Tanggungan yang sama dipilih dua kali.'; END IF;
   seen:=array_append(seen,target_id);
  ELSE
   IF target_id IS NOT NULL OR nullif(trim(item->>'dependant_name'),'') IS NULL THEN RAISE EXCEPTION 'Nama tanggungan baharu diperlukan.'; END IF;
  END IF;
  IF (item->>'age')::integer<0 THEN RAISE EXCEPTION 'Umur tidak boleh negatif.'; END IF;
  INSERT INTO public.dependant_update_items(update_id,target_dependant_id,dependant_name,dependant_ic,gender,age,relationship,item_status)
  VALUES(uid,target_id,nullif(trim(item->>'dependant_name'),''),nullif(trim(item->>'dependant_ic'),''),nullif(item->>'gender',''),(item->>'age')::integer,nullif(trim(item->>'relationship'),''),expected_status);
 END LOOP;
 END IF;
 RETURN uid;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_member_update(jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_member_update(jsonb,jsonb) TO anon,authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
