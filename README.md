# Keuangan

Aplikasi pencatatan keuangan pribadi berbasis Next.js, TypeScript, dan
Supabase. Seluruh data aplikasi disimpan langsung di cloud dan dilindungi
oleh Row Level Security (RLS).

## Menjalankan lokal

Pastikan Node.js 22 atau yang lebih baru tersedia, lalu jalankan:

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Pemeriksaan

```bash
npm run lint
npm run format:check
npm run build
```

Implementasi mengikuti tahapan pada
[`docs/10-ROADMAP-IMPLEMENTASI.md`](./docs/10-ROADMAP-IMPLEMENTASI.md).
Data aplikasi tidak disimpan di browser. Semua operasi data dilakukan langsung
melalui Supabase.

## Struktur kode

- `src/app/` berisi file routing Next.js seperti `page.tsx`, `layout.tsx`, dan
  `api/**/route.ts`. Halaman adalah Server Components yang mendelegasikan UI
  route ke fitur terkait.
- `src/components/shared/` berisi komponen lintas fitur seperti shell aplikasi.
- `src/components/ui/` berisi komponen UI dasar dan reusable.
- `src/features/<fitur>/components/` mengelompokkan halaman dan komponen khusus
  fitur. Komponen yang memakai state, event handler, atau browser API memiliki
  batas `"use client"` di dalam fitur; file route tetap Server Component.
- `src/features/<fitur>/api/` berisi query, mutation, dan alur data fitur yang
  menggunakan Supabase browser client serta tetap dilindungi RLS.
- `src/features/<fitur>/hooks/` menampung state, effects, dan alur interaktif
  sisi client yang dipakai halaman atau komponen fitur. State sederhana yang
  hanya mengatur satu kontrol dapat tetap berada di komponennya.
- `src/features/<fitur>/types.ts` menjadi tempat tipe khusus fitur. Tipe
  dashboard, transaksi, dompet, target, anggaran, aset, dan pinjaman tinggal
  bersama domain pemiliknya.
- Helper pemetaan/validasi dan inisialisasi data awal lintas domain berada di
  `src/features/finance/api/`. Konfigurasi browser client dan auth lintas fitur
  tetap di `src/lib/supabase/`.
- `src/features/account-center/` berisi pusat menu profil dan keluarga yang
  ditampilkan melalui route `/accounts`; domain rekening dan dompet keuangan
  berada di `src/features/wallets/`.
- `supabase/migrations/` mengikuti lokasi dan urutan file yang dibaca Supabase
  CLI; migration tidak dipindah ke dalam folder fitur.

## Supabase

1. Buat project Supabase melalui dashboard.
2. Hubungkan CLI ke project: `npx supabase link --project-ref <project-ref>`.
3. Terapkan seluruh migration ke project baru: `npx supabase db push`.
4. Salin `.env.example` menjadi `.env.local` dan isi URL serta anon/publishable
   key dari project tersebut.
5. Jangan pernah menaruh `service_role` key di `.env.local` yang dipakai browser.

Migration di `supabase/migrations/` diurutkan menurut dependensi dan domain:
inisialisasi, keluarga, dompet/kategori, transaksi/transfer, anggaran, aset,
target tabungan, pinjaman, lalu reporting dan hak akses lintas fitur. Supabase
CLI menerapkannya sesuai nomor awalan file. Setelah migration diterapkan pada
project bersama, jangan mengubah file tersebut; tambahkan migration baru.
`supabase db reset --linked` menghapus data project yang ditautkan, jadi
gunakan hanya saat memang ingin mengosongkan seluruh database dan akun.
Uji RLS di project staging dengan akun dan role berbeda sebelum menggunakan
data produksi.

## Keluarga

Route `/family` menyediakan pembuatan keluarga, daftar anggota aktif,
perubahan role editor/viewer, pencabutan akses, dan undangan email melalui
Edge Function `invite-family-member`. Owner tidak dapat dinonaktifkan jika
belum ada owner aktif lain. Service-role key hanya disimpan sebagai secret
Edge Function dan tidak pernah dikirim ke browser.

Deploy function dari root project menggunakan Supabase CLI:

```bash
supabase functions deploy invite-family-member
supabase functions deploy family-invitation-code
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_URL` dan `SUPABASE_ANON_KEY` tersedia sebagai secret bawaan pada
project Supabase. Jangan menaruh `SUPABASE_SERVICE_ROLE_KEY` di `.env.local`.

Pengguna yang sudah memiliki akun dapat bergabung melalui kode `KEU-XXXXXXXX`
di halaman `/family`. Owner dapat membuat kode untuk role viewer/editor; kode
disimpan sebagai hash, berlaku 24 jam, dan hanya dapat digunakan sekali.

## Realtime

Semua operasi data utama membaca dan menulis langsung ke Supabase. Aplikasi
menggunakan Supabase Realtime untuk meminta halaman memuat ulang ketika akun,
kategori, transaksi, atau transfer berubah pada perangkat lain. Tidak ada
IndexedDB, backup lokal, service worker, atau antrean sinkronisasi di runtime
aplikasi.
