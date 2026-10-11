# Dokumentasi Aplikasi Pencatatan Keuangan

Paket ini adalah acuan implementasi aplikasi pencatatan keuangan berbasis **Next.js + TypeScript + PWA**, dengan pendekatan **local-first/offline-first**.

## Prinsip arsitektur

- Aplikasi harus tetap bisa mencatat dan membaca transaksi ketika offline.
- IndexedDB adalah penyimpanan operasional lokal pada tahap awal.
- Supabase/PostgreSQL menjadi backend cloud opsional untuk autentikasi, sinkronisasi, dan fitur keluarga.
- UI tidak boleh mengakses IndexedDB atau Supabase secara langsung; gunakan service dan repository.
- Jangan mengimplementasikan semua modul sekaligus. Ikuti urutan di `10-ROADMAP-IMPLEMENTASI.md`.
- Jangan menyimpan secret/service-role key Supabase di frontend.
- Backup/restore lokal harus tersedia sebelum sinkronisasi cloud dianggap siap.

## Isi paket

| File | Isi |
|---|---|
| `01-PRODUK-DAN-KEBUTUHAN.md` | Tujuan, ruang lingkup, fitur, dan kebutuhan nonfungsional |
| `02-ARSITEKTUR-SISTEM.md` | Arsitektur, aliran data, dan batas tanggung jawab |
| `03-STRUKTUR-PROJECT.md` | Struktur direktori Next.js |
| `04-ATURAN-BISNIS.md` | Aturan transaksi, saldo, transfer, aset, anggaran, dan keluarga |
| `05-OFFLINE-DAN-SINKRONISASI.md` | IndexedDB, antrean sync, konflik, dan backup |
| `06-KEAMANAN-DAN-PRIVASI.md` | Autentikasi, RLS, akses keluarga, dan perlindungan data |
| `07-UX-DAN-HALAMAN.md` | Peta halaman dan pengalaman pengguna |
| `08-ERD-DATABASE.md` | ERD Mermaid dan penjelasan entitas |
| `database/001_initial_schema.sql` | Rancangan skema PostgreSQL awal untuk Supabase |
| `09-STRATEGI-PENGUJIAN.md` | Skenario pengujian |
| `10-ROADMAP-IMPLEMENTASI.md` | Tahapan implementasi |
| `prompts/AI-IMPLEMENTATION-PROMPTS.md` | Prompt yang dapat diberikan kepada AI coding assistant |

## Keputusan desain awal

1. Nominal uang disimpan sebagai integer dalam satuan terkecil mata uang yang dipakai. Untuk IDR, nominal rupiah disimpan sebagai bilangan bulat rupiah, bukan `float`.
2. Transaksi dan transfer dipisahkan secara konseptual. Transfer memiliki satu record transfer dan dua efek ledger yang dibuat atomik.
3. Saldo akun dihitung dari saldo awal ditambah ledger transaksi yang relevan. Jangan memperbarui saldo dengan operasi terpisah yang bisa gagal sebagian.
4. Setiap record lokal memiliki ID UUID yang sama ketika dikirim ke cloud, agar sinkronisasi dapat idempoten.
5. Data pribadi dan data keluarga dipisahkan berdasarkan `owner_user_id` dan/atau `family_id`.
6. Skema SQL adalah rancangan awal untuk direview dan diuji sebelum dipakai pada data produksi. RLS perlu dites dengan akun dan peran yang berbeda.
