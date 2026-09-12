alter table public.members
add column if not exists home_phone text;

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
