with issues as (
  select
    'daftar_ahli_approved_tapi_tiada_dalam_members' as check_name,
    count(*) as issue_count
  from public.membership_checks mc
  where mc.check_type = 'daftar'
    and mc.status = 'approved'
    and not exists (
      select 1
      from public.members m
      where m.source_submission_id = mc.id
    )

  union all

  select
    'bayaran_verified_tapi_tiada_dalam_member_yearly_payments' as check_name,
    count(*) as issue_count
  from public.payments p
  where p.status = 'verified'
    and not exists (
      select 1
      from public.member_yearly_payments myp
      where myp.source_submission_id = p.id
    )

  union all

  select
    'tanggungan_tambah_approved_tapi_tiada_dalam_member_dependants' as check_name,
    count(*) as issue_count
  from public.dependant_updates du
  where du.status = 'approved'
    and exists (
      select 1
      from public.dependant_update_items dui
      where dui.update_id = du.id
        and dui.item_status = 'Tambah'
    )
    and not exists (
      select 1
      from public.member_dependants md
      where md.source_submission_id = du.id
    )

  union all

  select
    'pindahan_approved_tapi_tiada_dalam_inactive_members' as check_name,
    count(*) as issue_count
  from public.kariah_exit_requests ker
  where ker.status = 'approved'
    and not exists (
      select 1
      from public.inactive_members im
      where lower(coalesce(im.member_name, '')) = lower(coalesce(ker.member_name, ''))
        and coalesce(im.member_no, '') = coalesce(ker.member_identifier, '')
    )

  union all

  select
    'pending_approval_semakan_daftar' as check_name,
    count(*) as issue_count
  from public.membership_checks
  where status = 'pending'

  union all

  select
    'pending_approval_tanggungan' as check_name,
    count(*) as issue_count
  from public.dependant_updates
  where status = 'pending'

  union all

  select
    'pending_approval_bayaran' as check_name,
    count(*) as issue_count
  from public.payments
  where status = 'pending'
),
results as (
  select
    check_name,
    issue_count,
    case
      when check_name like 'pending_%' then 'info'
      when issue_count = 0 then 'ok'
      else 'perlu_semak'
    end as status
  from issues
)
select *
from results
order by
  case
    when status = 'perlu_semak' then 1
    when status = 'info' then 2
    else 3
  end,
  check_name;
