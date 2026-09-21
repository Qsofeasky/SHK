# Supabase Storage Upload untuk Gambar IC

Flow ini digunakan untuk borang daftar ahli baru:

1. User upload gambar IC.
2. Website hantar gambar ke Supabase Edge Function `ic-proof-storage`.
3. Edge Function upload gambar ke private bucket `ic-proofs`.
4. Path gambar disimpan dalam table `membership_checks`.
5. Admin tekan `Buka gambar IC` untuk jana signed link sementara dan buka gambar.

## SQL Yang Perlu Run

Run isi fail ini dalam Supabase SQL Editor:

```text
supabase-import/fix_supabase_storage_ic_upload.sql
```

Jangan paste nama fail sahaja. Buka fail itu, copy semua isi SQL, kemudian paste dan tekan Run.

## Supabase Secret Yang Perlu Ada

Edge Function ini guna service role key yang project ini sudah pakai untuk function lain:

```text
SHK_SERVICE_ROLE_KEY
```

Kalau belum ada, set melalui terminal:

```bash
supabase secrets set SHK_SERVICE_ROLE_KEY="service-role-key-supabase"
```

## Deploy Function

Deploy Edge Function:

```bash
supabase functions deploy ic-proof-storage
```

Selepas deploy, test daftar ahli baru dengan upload gambar IC.

## Had Saiz Gambar

Had semasa ialah 700KB untuk satu gambar IC. Jika gambar dari telefon terlalu besar, compress dahulu sebelum upload.
