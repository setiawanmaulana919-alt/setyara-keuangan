# 09 — Strategi Pengujian

## 1. Unit tests aturan bisnis
- Nominal nol dan negatif ditolak.
- Pemasukan menambah saldo.
- Pengeluaran mengurangi saldo.
- Transfer mengurangi saldo akun asal dan menambah saldo akun tujuan dengan jumlah sama.
- Transfer tidak dihitung sebagai pemasukan/pengeluaran.
- Penghapusan atau perubahan transaksi memperbarui hasil saldo dan laporan.
- Filter tanggal dan kategori memberikan hasil benar.
- Pengeluaran kategori dihitung ke anggaran yang tepat.

## 2. IndexedDB dan backup
- Data bertahan setelah reload.
- Operasi tulis tidak meninggalkan data parsial.
- Migrasi skema lokal bekerja dari versi sebelumnya.
- Ekspor lalu impor menghasilkan data yang setara.
- File rusak atau versi tidak didukung ditolak dengan pesan yang jelas.
- Restore tidak menggandakan data tanpa aturan yang disepakati.

## 3. PWA/offline
- Setelah aplikasi dibuka online dan aset ter-cache, halaman utama dapat dibuka offline.
- Membuat, mengedit, mencari, dan membaca transaksi tetap berfungsi offline.
- Status offline ditampilkan.
- Tidak ada pesan palsu bahwa data sudah tersinkron ke cloud.
- Penggunaan pada browser target diuji secara nyata.

## 4. Sinkronisasi
- Operasi lokal terkirim setelah koneksi tersedia.
- Pengiriman ulang tidak menghasilkan duplikasi.
- Error sementara di-retry.
- Error validasi tidak di-retry tanpa batas.
- Perubahan pada dua perangkat memicu aturan konflik yang benar.
- Transfer tidak pernah tersinkron sebagian.
- Logout dan pergantian akun tidak membocorkan antrean ke akun lain.

## 5. Keamanan cloud
- Pengguna A tidak bisa membaca atau mengubah data pribadi pengguna B.
- Viewer tidak bisa membuat, mengubah, atau menghapus data bersama.
- Editor tidak bisa mengubah role owner.
- Anggota yang dinonaktifkan kehilangan akses.
- Data scope pribadi dan keluarga tidak dapat dicampur secara tidak sah.
- RLS diuji melalui role pengguna nyata, bukan hanya menggunakan service-role key.

## 6. End-to-end
- Onboarding lokal.
- Tambah transaksi.
- Transfer antarakun.
- Ekspor dan restore backup.
- Instalasi PWA.
- Sinkronisasi setelah offline.
- Login dan akses keluarga pada tahap cloud.
