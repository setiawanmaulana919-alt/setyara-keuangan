# 05 — Offline, Backup, dan Sinkronisasi

## 1. Sumber data

### Tahap lokal
IndexedDB adalah sumber data utama. Semua operasi inti dilakukan pada repository lokal.

### Tahap cloud
Setelah sync diaktifkan, IndexedDB tetap menjadi sumber pengalaman pengguna saat offline. Supabase menyimpan salinan cloud dan mendistribusikan perubahan lintas perangkat.

Jangan membuat sebagian halaman membaca lokal dan halaman lain membaca cloud secara langsung. Semua pembacaan harus lewat repository/service yang konsisten.

## 2. Data lokal minimum

- Entitas bisnis yang dibutuhkan aplikasi.
- Metadata sync: `sync_status`, `updated_at`, `deleted_at` jika soft delete dipakai.
- Antrean operasi yang belum berhasil dikirim.
- Versi skema lokal.
- Preferensi dan status onboarding yang tidak sensitif.

## 3. Sync queue

Setiap operasi antrean sebaiknya menyimpan:
- `operation_id`: UUID unik.
- `entity_type`: tipe entitas.
- `entity_id`: ID record stabil.
- `operation`: create/update/delete.
- `payload`: snapshot perubahan yang dibutuhkan.
- `created_at`.
- `attempt_count`.
- `last_error`.
- `status`: pending, processing, failed, synced.

Jangan menyimpan kredensial atau token autentikasi di payload antrean. Validasi payload dan batasi ukurannya.

## 4. Idempotency dan retry

- ID transaksi dibuat di klien dan dipakai juga di cloud.
- Pengiriman ulang operasi tidak boleh membuat record ganda.
- Server harus menerapkan upsert/unique constraint yang sesuai.
- Retry menggunakan jeda bertahap dan batas percobaan yang wajar.
- Error autentikasi atau validasi tidak boleh diulang tanpa batas.
- Kegagalan harus dapat dilihat pengguna tanpa menghilangkan data lokal.

## 5. Konflik

Strategi awal yang disarankan:
- Entitas yang diedit di satu perangkat: sync normal.
- Jika record berubah di dua perangkat: bandingkan `updated_at`/versi dan tandai konflik bila kedua perubahan bermakna.
- Jangan memakai last-write-wins secara diam-diam untuk perubahan transaksi keuangan.
- Sediakan pilihan pengguna atau aturan resolusi yang eksplisit.
- Untuk transfer, perlakukan pasangan debit/kredit sebagai satu operasi domain.

Timestamp klien bisa berbeda akibat jam perangkat. Untuk resolusi yang penting, gunakan versi record/server timestamp dan aturan yang terdokumentasi.

## 6. Backup dan restore

- Ekspor data dalam format JSON berversi.
- Backup berisi `schema_version`, `exported_at`, data, dan checksum bila implementasi mendukungnya.
- Validasi format dan batas ukuran sebelum impor.
- Tawarkan mode restore: mengganti data lokal atau menggabungkan data berdasarkan ID.
- Jangan melakukan merge otomatis tanpa aturan duplikasi yang jelas.
- Pertimbangkan enkripsi file backup, karena berisi data finansial.
- Uji backup dan restore dengan data nyata sintetis sebelum rilis.

## 7. Pemicu sinkronisasi

Coba sinkronisasi:
- Saat aplikasi dibuka.
- Ketika browser kembali online.
- Setelah perubahan lokal jika cloud sync aktif dan online.
- Saat pengguna menekan tombol sinkronisasi manual.

Jangan mengandalkan background sync browser sebagai satu-satunya cara sinkronisasi.
