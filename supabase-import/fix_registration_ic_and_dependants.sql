alter table public.membership_checks
add column if not exists residence_type text;

alter table public.membership_checks
add column if not exists ic_proof_data text;

alter table public.membership_checks
add column if not exists ic_proof_name text;

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
