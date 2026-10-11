# 06 — Keamanan dan Privasi

## 1. Prinsip dasar

- Terapkan least privilege.
- Jangan pernah mengirim Supabase service-role key ke frontend.
- Jangan menyimpan password mentah.
- Jangan menganggap UUID yang sulit ditebak sebagai pengganti authorization.
- Validasi data di klien untuk UX dan di server/database untuk keamanan.
- RLS harus aktif pada semua tabel cloud yang dapat diakses klien.
- Hindari mencatat nominal transaksi, token, atau informasi sensitif dalam log produksi.

## 2. Autentikasi

- Supabase Auth mengelola akun online.
- Pengguna offline tanpa akun dapat memakai profil lokal anonim pada perangkat.
- Saat akun online ditambahkan, proses menghubungkan data lokal ke akun harus eksplisit.
- Sediakan logout yang menjelaskan apakah data lokal tetap tersimpan pada perangkat.
- Token ditangani oleh library autentikasi yang sesuai, bukan disimpan sendiri dalam file plaintext.

## 3. RLS dan akses keluarga

- Pengguna hanya dapat membaca data pribadi miliknya.
- Anggota keluarga hanya dapat membaca data keluarga tempat ia menjadi anggota aktif.
- `viewer` hanya boleh SELECT.
- `editor` dapat melakukan operasi transaksi sesuai izin.
- `owner` dapat mengelola anggota dan pengaturan keluarga.
- Jangan mengandalkan `family_id` yang dikirim klien tanpa memeriksa membership di database.
- Perubahan role, undangan, dan pengeluaran anggota harus divalidasi server/database.

## 4. Perangkat lokal

- IndexedDB tidak otomatis terenkripsi oleh aplikasi.
- Lindungi akses perangkat dengan keamanan sistem operasi.
- Jangan menampilkan data keuangan sensitif dalam notifikasi tanpa persetujuan.
- Sediakan backup yang dapat dilindungi.
- Berikan opsi menghapus seluruh data lokal.
- Jelaskan bahwa membersihkan data browser dapat menghapus data lokal.

## 5. Checklist sebelum online

- [ ] RLS aktif untuk semua tabel yang diakses frontend.
- [ ] Tes pengguna A tidak bisa membaca data pribadi pengguna B.
- [ ] Tes viewer tidak dapat menulis atau menghapus.
- [ ] Tes anggota keluarga yang sudah keluar kehilangan akses.
- [ ] Secret tidak ada di bundle browser atau repo.
- [ ] Error dan log tidak membocorkan data transaksi.
- [ ] Backup/restore telah diuji.
- [ ] Migrasi database diuji pada database staging.
