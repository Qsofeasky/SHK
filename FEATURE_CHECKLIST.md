# SHK Feature Checklist

## Public Website

- Semakan status keahlian: pilih `Status keahlian`, masukkan `No. Telefon` sahaja.
- Semakan bayaran tahunan: pilih `Status bayaran tahunan`, masukkan `No. Telefon` sahaja.
- Daftar ahli baru: nama, IC, telefon, email, pekerjaan, alamat dan pilihan share lokasi akan muncul.
- Bayaran: pilih sama ada masukkan no. resit/reference atau upload gambar resit. Hanya satu tempat bukti digunakan.
- Sumbangan bukan ahli: orang luar boleh hantar rekod sumbangan tanpa no. resit atau link bukti.
- Contact: link lokasi Surau Haji Kamaruddin kekal buka Google Maps.

## Admin Website

- Pengesahan resit: hanya ada dalam `admin.html`.
- Pindahan Ahli: admin isi nama ahli dan no. IC, kemudian rekod masuk `inactive_members` dan tab `Pindahan Ahli`.
- Approval: admin boleh lihat pending, approved, rejected untuk semakan/daftar ahli, tanggungan dan bayaran.
- Sumbangan bukan ahli: ada tab admin asing.
- Bayaran: admin boleh verify/reject, isi rujukan bank statement, dan bawa lebihan bayaran ke tahun depan.
- Paid / Not Paid: admin boleh cari nama, no. ahli atau email dalam table ahli aktif tahun semasa.
- Pengesahan Resit: ada tab admin asing untuk cari no. resit.
- Email Reminder: backend auto boleh dipasang melalui Edge Function, tetapi tab manual dibuang dari admin website.
- Database Backup: backup auto bulanan melalui schedule Supabase, tetapi tab manual dibuang dari admin website.

## Supabase

Run latest `supabase-schema.sql` after every schema change.

For missing columns, run:

`supabase-import/fix_missing_payment_columns.sql`

For view errors, run:

`supabase-import/fix_recreate_views.sql`
