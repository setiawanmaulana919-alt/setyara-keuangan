# 04 — Aturan Bisnis Keuangan

## 1. Nominal dan tanggal

- Untuk IDR, nominal transaksi berupa integer rupiah positif.
- Jangan memakai JavaScript `float` untuk menyimpan uang.
- Simpan tanggal transaksi sebagai ISO date atau timestamp dengan aturan zona waktu yang konsisten.
- Tanggal pencatatan (`created_at`) berbeda dari tanggal transaksi (`transaction_date`).
- Format tanggal dan angka mengikuti locale pengguna, tetapi nilai internal tetap konsisten.

## 2. Akun dan saldo

Setiap akun memiliki saldo awal dan tanggal saldo awal. Saldo berjalan dihitung sebagai:

`saldo = saldo_awal + total_pemasukan - total_pengeluaran + transfer_masuk - transfer_keluar`

Rumus di atas hanya ilustrasi. Implementasi harus menentukan sumber ledger yang tunggal agar transaksi tidak dihitung dua kali.

- Akun yang diarsipkan tidak dihapus jika sudah memiliki transaksi.
- Saldo negatif boleh atau tidak boleh bergantung pada konfigurasi produk; tentukan perilakunya secara eksplisit.
- Perubahan atau penghapusan transaksi harus memengaruhi laporan dan saldo turunan secara konsisten.

## 3. Transaksi pemasukan/pengeluaran

- Pemasukan menambah saldo akun.
- Pengeluaran mengurangi saldo akun.
- Setiap transaksi memiliki satu akun dan kategori yang sesuai.
- Kategori pemasukan tidak boleh digunakan pada transaksi pengeluaran, dan sebaliknya.
- Nominal harus lebih besar dari nol.
- Deskripsi/catatan boleh kosong.
- Soft delete atau audit log dapat dipertimbangkan untuk kebutuhan pemulihan; bila memakai soft delete, semua query harus mengecualikan data terhapus secara konsisten.

## 4. Transfer

- Transfer memindahkan uang antar dua akun milik scope yang sama.
- Akun asal dan tujuan harus berbeda.
- Nominal harus positif.
- Transfer harus atomik: debit dan kredit tidak boleh tersimpan hanya sebelah.
- Transfer tidak dihitung sebagai pemasukan atau pengeluaran pada laporan arus pemasukan/pengeluaran.
- Biaya transfer, jika didukung, dicatat sebagai pengeluaran terpisah.
- Transfer lintas mata uang tidak termasuk versi pertama.

## 5. Kategori

- Pengguna dapat menambah, mengubah, mengarsipkan, dan mengurutkan kategori.
- Kategori default dapat dibuat saat inisialisasi.
- Kategori yang telah dipakai transaksi tidak dihapus permanen; arsipkan.
- Contoh kategori pemasukan: Pokok, Sampingan.
- Contoh kategori pengeluaran: Pokok, Tambahan, Darurat, Lainnya.
- Kategori harus memiliki tipe `income` atau `expense`.

## 6. Anggaran

- Anggaran memiliki periode dan kategori.
- Pengeluaran aktual dihitung dari transaksi pengeluaran pada periode dan kategori yang sesuai.
- Transfer tidak dihitung sebagai pengeluaran anggaran.
- Tampilkan penggunaan anggaran dan sisa anggaran.
- Kebijakan jika pengeluaran melebihi anggaran adalah peringatan, bukan pemblokiran, kecuali pengguna memilih sebaliknya.

## 7. Aset dan target tabungan

- Aset adalah ringkasan kepemilikan, bukan akun kas secara otomatis.
- Pembelian aset yang menggunakan uang dari akun harus direpresentasikan agar kas tidak dihitung ganda.
- Nilai pasar aset yang berubah perlu menyimpan riwayat valuasi jika grafik historis diperlukan.
- Target tabungan tidak otomatis menambah saldo. Kontribusi ke target harus dihubungkan dengan transaksi atau alokasi yang jelas.

## 8. Data keluarga

- Data pribadi dimiliki pengguna.
- Data bersama berada pada scope keluarga/grup.
- Setiap record harus memiliki owner atau scope keluarga yang jelas.
- `owner`, `editor`, dan `viewer` memiliki izin berbeda.
- Viewer tidak boleh membuat, mengubah, atau menghapus transaksi.
- Jangan memindahkan data pribadi ke keluarga secara implisit.
- Perubahan scope harus eksplisit dan tercatat.

## 9. Penghapusan dan audit

- Konfirmasi penghapusan transaksi.
- Perubahan yang belum tersinkron tidak boleh hilang tanpa peringatan.
- Jika diperlukan, gunakan soft delete dan audit trail.
- Backup harus mencakup versi skema dan metadata yang cukup untuk validasi saat restore.
