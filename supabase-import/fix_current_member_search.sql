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
