# SHK: kemaskini ahli dan tanggungan

Kod projek telah diubah. Database sebenar belum diubah dalam sesi ini.

## Aktifkan

1. Supabase SQL Editor, projek `hrvbnayanswugfwdfhto`: jalankan keseluruhan `SHK-kemaskini-dan-tanggungan.sql`. Skrip ini sudah merangkumi prasyarat pautan ID ahli; tidak perlu menjalankan fail lama berasingan.
2. Jalankan `SHK-pulihkan-semua-kemaskini.sql`. Baca setiap baris laporan. `applied` bermaksud berjaya disimpan. `SEMAK` atau `SKIP` masih memerlukan tindakan; jangan anggap semua rekod sudah pulih hanya kerana SQL berjaya dijalankan.
3. Commit dan push perubahan dalam projek SHK: `index.html`, `script.js`, `admin.html`, `admin.js`, `supabase-schema.sql` serta `supabase-import/fix_member_update_workflow.sql`. Tunggu deploy Cloudflare, kemudian refresh laman awam dan admin.

## Ahli

- Pilih Kemaskini Maklumat Diri, Tambah Tanggungan, Kurangkan Tanggungan atau Kemaskini Maklumat Tanggungan.
- Isi nama penuh seperti rekod dan telefon/IC terkini. Bagi kemaskini diri, nama lama boleh dikosongkan jika tidak ingat; telefon/IC tetap diperlukan.
- Rekod dimuatkan secara automatik selepas input lengkap. Butang Semak Maklumat Terkini juga tersedia untuk cuba semula.
- Senarai tanggungan semasa dipaparkan bersama hubungan, jantina, umur dan IC terlindung.
- Tambah: isi baris baharu. Kurangkan atau kemaskini: pilih tanggungan daripada senarai semasa. Nama atau IC yang diedit tidak menukar identiti baris asal.
- Biarkan isian IC kosong jika mahu mengekalkan IC tanggungan. Tekan Semak Maklumat Terkini semula untuk membatalkan pilihan dan memuatkan senarai semasa.
- Hantar permohonan; perubahan hanya berkuat kuasa selepas kelulusan admin.

## Admin dan rekod lama

Kelulusan baharu menyimpan semua perubahan dan status bersama-sama dalam satu transaksi. Jika mana-mana baris gagal, semua perubahan permohonan itu dibatalkan. Bilangan tanggungan dikira berdasarkan rekod sebenar, termasuk sifar.

Permohonan lama berstatus diluluskan tetapi belum mempunyai penanda simpanan memaparkan Semak dan Pulihkan. Semak maklumat permohonan, kemudian sahkan nombor ahli asal. Sistem memaparkan nama ahli sebelum pengesahan. Rekod yang tidak sepadan, tanggungan sudah tiada, atau permohonan lama yang berisiko menimpa permohonan lebih baharu tidak dipaksa.

Pemulihan kelompok menyokong kemaskini diri serta tambah, buang dan kemaskini tanggungan apabila pemilik dan sasaran dapat dipadankan secara unik. Rekod tanggungan lama yang mungkin telah dipadam atau IC telah berubah memerlukan semakan manual. Skrip tidak mencipta ahli utama yang tidak wujud.

Dua permohonan Ahmad Zaki telah dipautkan kepada ahli 168 berdasarkan pengesahan identiti dalam chat. Bagi ahli lain, sistem tidak membuat tekaan berdasarkan nama sahaja.

Salinan rekod ahli dan senarai tanggungan sebelum setiap perubahan disimpan dalam `member_update_audit` untuk rujukan admin. Rekod bayaran tidak dipadam. Kelulusan yang telah disahkan tersimpan tidak diulang.

## Pengesahan

19 ujian aliran PostgreSQL, 7 ujian interaksi DOM borang, 14 ujian carian/pautan bayaran, dan 3 ujian padanan ID admin lulus. Termasuk transaksi gagal separuh, pemilikan tanggungan, IC berubah, umur sifar, muat semula SQL, kelulusan berulang, sesi bukan admin dan respons carian lama yang tiba lewat. Semakan sintaks JavaScript lulus. Ujian menggunakan data rekaan; pengesahan pada data sebenar masih perlu selepas SQL dijalankan.


Semakan akhir membaca semula setiap tanggungan dan bilangan ahli sebelum merekodkan kelulusan. Jika database mengabaikan perubahan, transaksi dibatalkan. Untuk pemasangan yang sudah menjalankan SQL aliran baharu, kemas kini fungsi melalui SHK-sahkan-kelulusan-tanggungan.sql, kemudian deploy admin.js dan admin.html terkini.
