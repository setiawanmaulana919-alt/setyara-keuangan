# 03 — Struktur Project

Struktur berikut adalah target yang dapat disesuaikan setelah kebutuhan versi pertama stabil.

```text
finance-app/
├── docs/
│   ├── README.md
│   ├── 01-PRODUK-DAN-KEBUTUHAN.md
│   ├── 02-ARSITEKTUR-SISTEM.md
│   ├── 03-STRUKTUR-PROJECT.md
│   ├── 04-ATURAN-BISNIS.md
│   ├── 05-OFFLINE-DAN-SINKRONISASI.md
│   ├── 06-KEAMANAN-DAN-PRIVASI.md
│   ├── 07-UX-DAN-HALAMAN.md
│   ├── 08-ERD-DATABASE.md
│   ├── 09-STRATEGI-PENGUJIAN.md
│   └── 10-ROADMAP-IMPLEMENTASI.md
├── public/
│   ├── icons/
│   └── manifest.webmanifest
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── dashboard/
│   │   │   ├── transactions/
│   │   │   ├── accounts/
│   │   │   ├── budgets/
│   │   │   ├── assets/
│   │   │   ├── goals/
│   │   │   ├── reports/
│   │   │   ├── family/
│   │   │   └── settings/
│   │   ├── login/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── forms/
│   │   └── feedback/
│   ├── features/
│   │   ├── transactions/
│   │   ├── accounts/
│   │   ├── categories/
│   │   ├── budgets/
│   │   ├── assets/
│   │   ├── goals/
│   │   └── family/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   ├── migrations.ts
│   │   │   └── repositories/
│   │   ├── sync/
│   │   ├── supabase/
│   │   ├── validation/
│   │   └── utils/
│   ├── services/
│   ├── types/
│   └── workers/
├── supabase/
│   └── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Aturan struktur

- `app/`: routing dan komposisi halaman.
- `components/ui/`: komponen umum yang tidak berisi aturan domain.
- `features/`: komponen, tipe, dan fungsi spesifik fitur.
- `services/`: use case dan aturan bisnis.
- `lib/db/`: skema IndexedDB, migrasi, dan repository lokal.
- `lib/sync/`: antrean operasi, retry, idempotency, dan resolusi konflik.
- `lib/supabase/`: konfigurasi klien dan adapter cloud.
- `types/`: tipe lintas fitur yang memang dipakai bersama.
- `workers/`: worker bila ada tugas yang perlu berjalan terpisah.

Hindari membuat satu file besar untuk semua fitur. Jangan membuat abstraksi berlebihan sebelum ada kebutuhan nyata.
