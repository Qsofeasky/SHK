# SHK — Yuran pendaftaran, yuran ahli dan lebihan automatik

Kod projek telah disediakan. Database dan website sebenar belum diubah dalam sesi ini.

## Aktifkan

1. Dalam SQL Editor projek Supabase SHK, jalankan keseluruhan `SHK-yuran-pendaftaran-ahli-dan-lebihan.sql`.
2. Commit dan push perubahan projek: `admin.js`, `admin.html`, `index.html`, `script.js`, `supabase-schema.sql`, `supabase-import/add_fee_types_and_carry_forward.sql`, serta panduan ini.
3. Tunggu Cloudflare deploy. Muat semula halaman awam dan admin.
4. Sebelum mengesahkan bayaran sebenar, semak IC ahli dan pratonton agihan yang dipaparkan.

SQL ini menggunakan pautan `member_id` dan fungsi padanan ahli daripada kemas kini SHK terdahulu yang sudah dipasang pada sistem ini.

## Kadar yang dipersetujui

| Umur daripada IC | Yuran pendaftaran sekali sahaja | Yuran ahli setahun |
|---|---:|---:|
| Bawah 60 tahun | RM50 | RM30 |
| 60 tahun ke atas, termasuk tepat 60 | RM30 | RM20 |

Kadar digunakan untuk pengesahan bayaran baharu selepas diaktifkan, termasuk tahun 2026. Mengikut pilihan pengguna, pengiraan automatik menggunakan umur daripada IC sahaja. Status pendapatan tidak dapat dikenal pasti daripada IC dan tidak diberi kadar berlainan secara automatik.

IC mesti lengkap dan tarikh lahir sah. Jika IC belum lengkap, jumlah bayaran lama tetap dipaparkan tetapi kadar/status kecukupan yuran ditandakan untuk semakan IC. Sistem tidak meneka umur daripada nama.

Umur dikira pada tarikh bayaran dihantar. Bagi peruntukan tahun hadapan, umur pada tarikh kalendar yang sama dalam tahun berkenaan digunakan. Kadar tahun yang telah menerima agihan baharu disimpan bersama rekod, supaya tambah bayar tahun yang sama menggunakan kadar yang konsisten. Tahun IC dua digit ditafsir pada abad semasa, atau abad sebelumnya apabila tarikh itu akan berada pada masa hadapan.

## Aliran bayaran

Pembayar memilih Yuran Ahli, Yuran Pendaftaran atau Pendaftaran + Yuran Ahli. Admin boleh menyemak jenis ini sebelum mengesahkan.

- **Yuran Ahli:** penuhkan baki tahun dipilih dahulu. Lebihan diagih ke tahun-tahun berikutnya sehingga habis.
- **Yuran Pendaftaran:** direkod berasingan dan tidak dianggap yuran ahli. Bayaran sebahagian diterima. Jika jumlah melebihi baki pendaftaran, pilih Pendaftaran + Yuran Ahli untuk mengagihkan lebihan secara jelas.
- **Pendaftaran + Yuran Ahli:** penuhkan baki pendaftaran dahulu, kemudian agih selebihnya sebagai yuran ahli.

Contoh jika kadar kekal RM30 setahun dan belum ada bayaran bagi tahun-tahun tersebut:

- RM40: RM30 tahun semasa, RM10 tahun hadapan (sebahagian).
- RM100: RM30 + RM30 + RM30 + RM10 untuk empat tahun berturut-turut.
- Tambah RM20 pada tahun yang sudah mempunyai RM10: tahun itu menjadi cukup RM30. Bayaran tidak dimulakan semula dari kosong.
- Pendaftaran + ahli RM80 untuk ahli bawah 60 yang belum mendaftar: RM50 pendaftaran + RM30 yuran ahli.

Jika kadar tahun hadapan menjadi RM20 kerana ahli mencapai umur 60, agihan menggunakan RM20 untuk tahun tersebut.

Sebelum admin menyimpan, pratonton memaparkan ahli, jenis, tahun, kadar dan jumlah agihan. Jika rekod bayaran lain berubah selepas pratonton, sistem meminta pratonton baharu. Pengesahan, agihan dan status disimpan dalam satu transaksi. Cubaan pengesahan semula tidak menggandakan bayaran.

## Paparan admin dan semakan awam

Bayaran Ahli kini mempunyai jadual berasingan untuk pendaftaran dan yuran ahli. Status membezakan cukup, sebahagian, belum bayar dan perlu IC. Jadual agihan tahunan menunjukkan peruntukan tahun hadapan. Pilihan tahun admin ditambah apabila agihan melangkaui senarai tahun asal.

Jumlah pendaftaran pada kad ringkasan ialah kutipan/peruntukan tahun dipilih; jadual status pendaftaran pula merangkumi keseluruhan keahlian kerana pendaftaran hanya sekali. Ringkasan yuran ahli mengikut tahun peruntukan, bukan tahun wang diterima. Oleh itu wang yang diterima sekarang untuk 2027 akan muncul pada jumlah peruntukan 2027.

Semakan bayaran awam mengumpulkan yuran ahli sahaja mengikut tahun dan menunjukkan status sebahagian atau cukup. Yuran pendaftaran tidak dikira sebagai bayaran tahunan.

## Rekod lama

Agihan bayaran lama tidak dikira semula secara automatik. Baris dalam `member_yearly_payments` dikekalkan sebagai yuran ahli seperti struktur asal. Bayaran pendaftaran import dalam `members.registration_member_amount` dan `registration_dependant_amount` dipaparkan sebagai rekod pendaftaran lama yang telah dibayar jika jumlahnya positif. Tahun pendaftaran import mesti empat digit untuk dimasukkan ke ringkasan tahun.

Bayaran lama yang telah disahkan atau mempunyai agihan tidak boleh disahkan semula melalui fungsi baharu. Ini mengelakkan wang yang sama dikira dua kali. Sebarang pengelasan semula rekod lama memerlukan semakan berasingan kerana rekod lama mungkin tidak menyatakan jenis yuran.

## Pengesahan

19 ujian integrasi PostgreSQL dan 9 ujian DOM berkaitan yuran lulus. Merangkumi tepat umur 60, pertukaran kadar tahun hadapan, RM40/RM100, bayaran sebahagian dan tambah bayar, pendaftaran sahaja/campuran, agihan berulang, wang/jenis tidak sah, IC tidak lengkap, pembatalan transaksi apabila simpanan diubah, pratonton lapuk, akses bukan admin, migrasi berulang dan pemeliharaan rekod lama. 8 ujian DOM tanggungan terdahulu turut lulus selepas perubahan ini. Semakan sintaks JavaScript lulus.

Semua ujian menggunakan data rekaan. Tiada bayaran sebenar dihantar atau disahkan dalam sesi ini.
