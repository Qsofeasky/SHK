alter table public.dependant_updates
add column if not exists new_residence_type text;

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
    select (regexp_match(receipt_no, '^SHK\s*-\s*([0-9]{1,4})\/' || receipt_year::text || '$', 'i'))[1]::integer as receipt_number
    from public.payments
    where receipt_no is not null
    union all
    select (regexp_match(receipt_no, '^SHK\s*-\s*([0-9]{1,4})\/' || receipt_year::text || '$', 'i'))[1]::integer as receipt_number
    from public.member_yearly_payments
    where receipt_no is not null
    union all
    select (regexp_match(receipt_no, '^SHK\s*-\s*([0-9]{1,4})\/' || receipt_year::text || '$', 'i'))[1]::integer as receipt_number
    from public.non_member_donations
    where receipt_no is not null
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
