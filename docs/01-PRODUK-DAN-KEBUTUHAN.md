# 01 — Spesifikasi Produk dan Kebutuhan

## 1. Tujuan

Membangun aplikasi pencatatan keuangan pribadi yang:
- Berjalan di browser desktop dan mobile.
- Dapat dipasang sebagai PWA di perangkat yang mendukung.
- Tetap berfungsi tanpa internet untuk operasi inti.
- Menyediakan pencatatan pemasukan, pengeluaran, transfer, aset, anggaran, dan target tabungan.
- Dapat dikembangkan untuk sinkronisasi cloud dan keuangan keluarga.

## 2. Pengguna dan ruang lingkup

### Pengguna awal
- Satu pengguna pada satu perangkat.
- Pengguna dapat menyimpan transaksi secara lokal tanpa akun online.

### Pengembangan berikutnya
- Akun pengguna melalui Supabase Auth.
- Sinkronisasi lintas perangkat.
- Keluarga/grup keuangan bersama.
- Peran pemilik, editor, dan viewer.

## 3. Fitur

### P0 — wajib untuk versi lokal pertama
- Dashboard ringkasan.
- CRUD transaksi.
- Kategori pemasukan dan pengeluaran.
- Akun/sumber dana: uang tunai, rekening, dompet digital, dan lainnya.
- Transfer antar-akun.
- Filter transaksi berdasarkan tanggal, kategori, akun, dan tipe.
- Perhitungan saldo dan ringkasan periode.
- Pengaturan mata uang awal IDR.
- IndexedDB sebagai penyimpanan utama.
- Ekspor dan impor backup.
- Indikator status penyimpanan lokal.
- Validasi input dan konfirmasi sebelum penghapusan.

### P1 — perencanaan keuangan
- Anggaran per kategori dan periode.
- Target tabungan.
- Pencatatan aset seperti emas dan investasi.
- Laporan bulanan.
- Pencarian transaksi.
- Pengaturan tema dan preferensi.

### P2 — online dan keluarga
- Login dan logout.
- Sinkronisasi cloud.
- Grup keluarga.
- Tabungan bersama.
- Role-based access: owner, editor, viewer.
- Indikator status sinkronisasi dan penanganan konflik.
- Backup cloud dan prosedur pemulihan.

## 4. Jenis transaksi

- `income`: pemasukan.
- `expense`: pengeluaran.
- `transfer`: pemindahan dana antarakun; sebaiknya memakai model transfer tersendiri agar debit dan kredit atomik.

Kategori pemasukan dapat mencakup pokok dan sampingan. Kategori pengeluaran dapat mencakup pokok, tambahan, darurat, dan kategori lain yang bisa dibuat pengguna.

## 5. Kebutuhan nonfungsional

- Offline-first: tambah, edit, hapus, daftar, filter, dan ringkasan transaksi inti berjalan tanpa internet.
- Konsistensi: nominal rupiah tidak memakai floating point.
- Keamanan: data lokal tidak dikirim ke server tanpa konfigurasi sinkronisasi yang jelas.
- Privasi: data pengguna berbeda tidak boleh saling terlihat.
- Aksesibilitas: form memiliki label, pesan validasi, dan navigasi keyboard.
- Responsif: layout dapat dipakai pada layar HP dan desktop.
- Pemulihan: backup dapat diekspor dan diimpor dengan validasi versi skema.
- Maintainability: UI, business logic, dan repository dipisah.
- Testing: aturan saldo, transfer, backup, dan sync memiliki automated tests.

## 6. Bukan sasaran versi pertama

- Integrasi otomatis rekening bank.
- Pembayaran atau transfer uang sungguhan.
- Saran investasi otomatis.
- Perhitungan pajak kompleks.
- Multi-currency dengan kurs historis.
- Sinkronisasi real-time sebelum alur offline dan backup stabil.
