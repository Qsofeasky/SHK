alter table public.membership_checks
add column if not exists ic_proof_url text;

alter table public.membership_checks
add column if not exists ic_proof_drive_file_id text;
