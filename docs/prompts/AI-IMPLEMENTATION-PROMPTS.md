# Prompt AI Coding Assistant

Gunakan prompt berikut satu per satu, bukan sekaligus.

## Prompt 1 — Baca dokumen dan rencanakan

Baca seluruh dokumen di folder `docs/`, terutama kebutuhan produk, arsitektur, aturan bisnis, offline, keamanan, ERD, pengujian, dan roadmap.

Jangan langsung membuat seluruh aplikasi. Ringkas keputusan arsitektur, identifikasi kontradiksi atau detail yang belum ditentukan, lalu ajukan pertanyaan hanya jika keputusan itu benar-benar menghalangi tahap pertama. Setelah itu usulkan daftar file yang akan dibuat pada Tahap 0.

## Prompt 2 — Fondasi project

Implementasikan Tahap 0 dari `10-ROADMAP-IMPLEMENTASI.md` saja. Gunakan Next.js App Router, TypeScript strict mode, struktur project pada dokumentasi, lint, format, dan test runner. Jangan menambahkan Supabase atau sinkronisasi cloud dahulu. Jangan membuat fitur keuangan yang belum dijadwalkan. Setelah selesai, jalankan pemeriksaan yang tersedia dan laporkan hasil nyata.

## Prompt 3 — IndexedDB

Implementasikan database lokal berdasarkan dokumen. Gunakan wrapper IndexedDB yang terpelihara, definisikan schema version dan migrasi, buat repository, dan tambahkan tes persistensi serta validasi. Semua operasi bisnis harus melalui service. Tambahkan ekspor/impor JSON berversi. Jangan menambahkan sinkronisasi cloud.

## Prompt 4 — Fitur keuangan inti

Implementasikan akun, kategori, pemasukan, pengeluaran, transfer atomik, dashboard, filter transaksi, dan laporan dasar. Ikuti `04-ATURAN-BISNIS.md`. Jangan gunakan floating-point untuk uang. Buat tes untuk saldo, transfer, edit, delete, dan laporan. Pastikan semua fitur bekerja offline.

## Prompt 5 — PWA

Implementasikan manifest, ikon placeholder yang jelas, service worker dan strategi cache yang kompatibel dengan versi Next.js project. Jangan cache data transaksi melalui cache aset umum. Tambahkan status offline dan tes manual yang terdokumentasi. Pastikan update aplikasi tidak mempertahankan bundle lama tanpa mekanisme pembaruan.

## Prompt 6 — Supabase

Sebelum mengimplementasikan cloud, review ERD dan SQL. Lengkapi constraint lintas-scope, migrasi, autentikasi, dan RLS untuk semua tabel yang dapat diakses frontend. Jangan mengirim service-role key ke browser. Buat tes isolasi data pengguna dan role keluarga. Implementasikan cloud sync hanya setelah tes keamanan lulus.

## Prompt 7 — Sync engine

Implementasikan antrean sinkronisasi idempoten, retry, status sync, konflik, dan sinkronisasi manual sesuai `05-OFFLINE-DAN-SINKRONISASI.md`. Jangan menghapus data lokal ketika request gagal. Jangan menyelesaikan konflik transaksi secara diam-diam. Tambahkan tes untuk pengiriman ulang, offline, dua perangkat, transfer, logout, dan pergantian akun.

## Aturan wajib untuk setiap tahap

- Kerjakan hanya tahap yang diminta.
- Sebelum mengedit, sebutkan rencana file yang berubah.
- Pertahankan kode yang sudah benar.
- Jangan menyatakan tes berhasil jika belum benar-benar dijalankan.
- Setelah perubahan, laporkan file, keputusan, perintah tes, hasil, dan masalah yang tersisa.
- Jika ada konflik antara kode dan dokumen, jelaskan dan minta keputusan atau usulkan perubahan dokumentasi terlebih dahulu.
