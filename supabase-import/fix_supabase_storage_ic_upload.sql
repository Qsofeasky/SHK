alter table public.membership_checks
add column if not exists ic_proof_storage_path text;

alter table public.membership_checks
add column if not exists ic_proof_url text;

alter table public.membership_checks
add column if not exists ic_proof_drive_file_id text;

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
