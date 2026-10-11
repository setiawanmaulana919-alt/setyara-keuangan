# 07 — UX dan Halaman

## 1. Navigasi utama

### Mobile
Gunakan navigasi bawah untuk halaman yang paling sering dipakai:
- Beranda
- Transaksi
- Tambah transaksi
- Anggaran
- Lainnya

### Desktop
Gunakan sidebar:
- Dashboard
- Transaksi
- Akun
- Anggaran
- Aset
- Target tabungan
- Laporan
- Keuangan keluarga
- Pengaturan

## 2. Dashboard

Tampilkan:
- Total saldo akun aktif.
- Pemasukan periode ini.
- Pengeluaran periode ini.
- Selisih arus kas.
- Ringkasan kategori pengeluaran.
- Tren pemasukan/pengeluaran.
- Target tabungan.
- Status offline dan status sync jika sync diaktifkan.

Jangan menjumlahkan nilai aset dan saldo kas sebagai “saldo tersedia” tanpa label yang jelas.

## 3. Form transaksi

Field:
- Jenis: pemasukan/pengeluaran.
- Nominal.
- Akun.
- Kategori.
- Tanggal transaksi.
- Catatan opsional.

Perilaku:
- Validasi nominal positif.
- Simpan lokal terlebih dahulu.
- Tampilkan status tersimpan.
- Jika cloud sync aktif, status lokal dan status sync dibedakan.
- Hindari kehilangan input saat navigasi atau koneksi terputus.

## 4. Form transfer

Field:
- Akun asal.
- Akun tujuan.
- Nominal.
- Tanggal.
- Catatan opsional.

Validasi akun asal dan tujuan berbeda. Simpan transfer sebagai operasi atomik.

## 5. Status aplikasi

Bedakan:
- Offline.
- Online, belum tersinkron.
- Sedang sinkronisasi.
- Tersinkron.
- Gagal sinkronisasi.

Jangan menampilkan “tersimpan di cloud” hanya karena data berhasil tersimpan di IndexedDB.

## 6. Visual design

- Utamakan hierarki informasi yang jelas.
- Gunakan warna untuk membedakan pemasukan, pengeluaran, dan status, tetapi jangan mengandalkan warna saja.
- Nominal menggunakan format lokal IDR.
- Gunakan konfirmasi untuk penghapusan dan tindakan yang sulit dibatalkan.
- Pastikan tombol dan form nyaman disentuh di layar mobile.
- Tampilkan empty state, loading, error, dan success state.
