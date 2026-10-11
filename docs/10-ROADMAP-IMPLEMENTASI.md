# 10 — Roadmap Implementasi

## Tahap 0 — Persiapan
- Baca semua dokumen.
- Putuskan kebutuhan P0 dan desain dasar.
- Buat project Next.js lokal.
- Aktifkan TypeScript strict mode, lint, formatter, dan test runner.
- Jangan hubungkan GitHub atau deploy sebelum pengguna siap.

Kriteria selesai: project berjalan lokal, struktur dasar jelas, lint dan build lulus.

## Tahap 1 — Database lokal
- Implementasikan IndexedDB.
- Definisikan model dan versi skema.
- Implementasikan repository dan migrasi.
- Buat backup/export/import.
- Tambahkan unit tests repository.

Kriteria selesai: data bertahan setelah reload dan backup dapat dipulihkan.

## Tahap 2 — Fitur inti
- Akun dan saldo awal.
- Kategori default dan kategori buatan pengguna.
- Pemasukan/pengeluaran.
- Transfer atomik.
- Daftar, filter, pencarian, dan dashboard.
- Laporan dasar.

Kriteria selesai: tes perhitungan saldo dan transfer lulus.

## Tahap 3 — PWA
- Manifest dan ikon.
- Service worker/cache aset dengan strategi yang tepat.
- Indikator offline.
- Tes install dan operasi offline.
- Periksa pembaruan aset/cache agar aplikasi tidak terjebak pada versi lama.

Kriteria selesai: aplikasi yang sudah dipersiapkan dapat dibuka dan digunakan offline pada browser target.

## Tahap 4 — Anggaran dan aset
- Anggaran kategori.
- Target tabungan.
- Aset dan valuasi.
- Laporan periodik.
- Perjelas agar nilai aset tidak terhitung sebagai kas.

## Tahap 5 — Cloud
- Buat project Supabase.
- Buat migration SQL.
- Implementasikan Auth dan profil.
- Aktifkan dan uji RLS.
- Implementasikan adapter cloud dan sync queue.
- Tambahkan status sync dan penanganan konflik.

Kriteria selesai: tes isolasi pengguna, role keluarga, idempotency, dan retry lulus.

## Tahap 6 — Keluarga
- Buat keluarga.
- Undang/daftarkan anggota.
- Terapkan role owner/editor/viewer.
- Pisahkan transaksi pribadi dan bersama.
- Uji pencabutan akses.

## Tahap 7 — Deployment
- Build dan tes produksi lokal.
- Siapkan environment variable.
- Deploy ke hosting.
- Uji PWA melalui HTTPS.
- Uji backup, restore, dan prosedur pemulihan.
- Siapkan domain bila diperlukan.

## Aturan pengerjaan AI
- Kerjakan satu tahap per permintaan.
- Sebelum mengubah file, jelaskan file yang akan dibuat/diubah.
- Jangan menghapus atau mengganti implementasi yang sudah ada tanpa alasan dan persetujuan.
- Setelah setiap tahap, jalankan lint, type-check, test, dan build yang relevan.
- Laporkan file yang berubah, hasil tes, keterbatasan, dan langkah berikutnya.
