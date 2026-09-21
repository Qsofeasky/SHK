# Google Drive Upload untuk Gambar IC

Flow ini digunakan untuk borang daftar ahli baru:

1. User upload gambar IC.
2. Website hantar gambar ke Supabase Edge Function `upload-ic-to-drive`.
3. Edge Function upload gambar ke Google Drive folder `SHK/Gambar IC`.
4. Link Google Drive disimpan dalam table `membership_checks`.
5. Admin boleh buka gambar IC dari dashboard.

## SQL Yang Perlu Run

Run isi fail ini dalam Supabase SQL Editor:

```text
supabase-import/fix_google_drive_ic_upload.sql
```

Jangan paste nama fail sahaja. Buka fail itu, copy semua isi SQL, kemudian paste dan tekan Run.

## Supabase Secrets Yang Perlu Ada

Dalam Supabase CLI atau dashboard Edge Function secrets, set:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account-email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
GOOGLE_DRIVE_IC_FOLDER_ID=folder_id_google_drive
```

Optional:

```text
GOOGLE_DRIVE_MAKE_PUBLIC=true
```

Jika `GOOGLE_DRIVE_MAKE_PUBLIC=true`, gambar boleh dibuka oleh sesiapa yang ada link. Untuk IC, lebih selamat jangan public. Pilihan selamat ialah share folder Google Drive itu dengan service account dan akaun Google admin yang perlu buka gambar.

## Setup Google Drive Ringkas

1. Buat Google Cloud project.
2. Enable Google Drive API.
3. Buat Service Account.
4. Download JSON key.
5. Ambil `client_email` sebagai `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
6. Ambil `private_key` sebagai `GOOGLE_PRIVATE_KEY`.
7. Buat folder Google Drive `SHK/Gambar IC`.
8. Share folder itu kepada service account email sebagai Editor.
9. Copy folder ID dari URL folder Google Drive.

Contoh URL folder:

```text
https://drive.google.com/drive/folders/PASTE_FOLDER_ID_DI_SINI
```

## Deploy Function

Deploy Edge Function:

```bash
supabase functions deploy upload-ic-to-drive
```

Selepas deploy, test daftar ahli baru dengan upload gambar IC.
