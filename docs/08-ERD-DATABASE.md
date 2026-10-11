# 08 — ERD Database

ERD ini adalah model target untuk versi cloud. Untuk tahap offline awal, entitas utama yang sama disimpan di IndexedDB. Skema cloud dapat diimplementasikan bertahap; tidak semua tabel harus dibuat pada sprint pertama.

## 1. ERD konseptual

```mermaid
erDiagram
    AUTH_USERS ||--o| PROFILES : has
    AUTH_USERS ||--o{ FAMILIES : owns
    FAMILIES ||--o{ FAMILY_MEMBERS : contains
    PROFILES ||--o{ FAMILY_MEMBERS : joins

    PROFILES ||--o{ ACCOUNTS : owns
    FAMILIES ||--o{ ACCOUNTS : shares
    PROFILES ||--o{ CATEGORIES : owns
    FAMILIES ||--o{ CATEGORIES : shares

    ACCOUNTS ||--o{ TRANSACTIONS : records
    CATEGORIES ||--o{ TRANSACTIONS : classifies
    PROFILES ||--o{ TRANSACTIONS : creates
    FAMILIES ||--o{ TRANSACTIONS : scopes

    ACCOUNTS ||--o{ TRANSFERS : source
    ACCOUNTS ||--o{ TRANSFERS : destination
    PROFILES ||--o{ TRANSFERS : creates
    FAMILIES ||--o{ TRANSFERS : scopes

    PROFILES ||--o{ BUDGETS : owns
    FAMILIES ||--o{ BUDGETS : shares
    CATEGORIES ||--o{ BUDGETS : limits

    PROFILES ||--o{ ASSETS : owns
    FAMILIES ||--o{ ASSETS : shares
    ASSETS ||--o{ ASSET_VALUATIONS : has

    PROFILES ||--o{ SAVINGS_GOALS : owns
    FAMILIES ||--o{ SAVINGS_GOALS : shares
    SAVINGS_GOALS ||--o{ GOAL_CONTRIBUTIONS : receives
    TRANSACTIONS o|--o{ GOAL_CONTRIBUTIONS : may_link

    PROFILES {
        uuid id PK
        text display_name
        timestamptz created_at
    }
    FAMILIES {
        uuid id PK
        uuid owner_user_id FK
        text name
        timestamptz created_at
    }
    FAMILY_MEMBERS {
        uuid id PK
        uuid family_id FK
        uuid user_id FK
        text role
        text status
    }
    ACCOUNTS {
        uuid id PK
        uuid owner_user_id FK
        uuid family_id FK
        text name
        text account_type
        bigint opening_balance
        date opening_balance_date
    }
    CATEGORIES {
        uuid id PK
        uuid owner_user_id FK
        uuid family_id FK
        text name
        text transaction_type
    }
    TRANSACTIONS {
        uuid id PK
        uuid owner_user_id FK
        uuid family_id FK
        uuid account_id FK
        uuid category_id FK
        text transaction_type
        bigint amount
        date transaction_date
    }
    TRANSFERS {
        uuid id PK
        uuid owner_user_id FK
        uuid family_id FK
        uuid from_account_id FK
        uuid to_account_id FK
        bigint amount
        date transfer_date
    }
    BUDGETS {
        uuid id PK
        uuid owner_user_id FK
        uuid family_id FK
        uuid category_id FK
        bigint amount_limit
        date period_start
        date period_end
    }
    ASSETS {
        uuid id PK
        uuid owner_user_id FK
        uuid family_id FK
        text name
        text asset_type
        bigint acquisition_value
    }
    ASSET_VALUATIONS {
        uuid id PK
        uuid asset_id FK
        date valuation_date
        bigint market_value
    }
    SAVINGS_GOALS {
        uuid id PK
        uuid owner_user_id FK
        uuid family_id FK
        text name
        bigint target_amount
        date target_date
    }
    GOAL_CONTRIBUTIONS {
        uuid id PK
        uuid goal_id FK
        uuid transaction_id FK
        bigint amount
        date contribution_date
    }
```

## 2. Penjelasan relasi

- `auth.users` dikelola Supabase Auth; tabel `profiles` menyimpan profil aplikasi.
- `families` adalah ruang lingkup data bersama.
- `family_members` menghubungkan pengguna dan keluarga serta menyimpan role.
- `accounts` menyimpan rekening/sumber saldo pribadi atau bersama.
- `categories` menyimpan kategori transaksi dengan tipe pemasukan atau pengeluaran.
- `transactions` mencatat pemasukan dan pengeluaran.
- `transfers` mencatat perpindahan dana antarakun secara atomik.
- `budgets` menghubungkan anggaran ke kategori dan periode.
- `assets` menyimpan aset non-kas; `asset_valuations` menyimpan nilai historis.
- `savings_goals` menyimpan target; `goal_contributions` menghubungkan kontribusi ke target.

## 3. Keputusan data

- ID seluruh entitas menggunakan UUID yang dibuat klien, agar ID lokal dan cloud dapat konsisten.
- Nominal menggunakan `bigint` dan rupiah bulat untuk IDR.
- Untuk versi multi-currency, tambahkan kode mata uang dan aturan konversi secara eksplisit.
- Record yang dimiliki pribadi memiliki `owner_user_id`; record bersama memiliki `family_id`. Tentukan constraint yang memastikan scope valid.
- Untuk transaksi, akun, dan kategori yang memiliki scope, pastikan akun/kategori berasal dari scope yang sama.
- RLS tidak cukup hanya memeriksa `family_id`; membership aktif dan role juga harus diperiksa.
- ERD ini bersifat konseptual dan SQL awal di folder `database/` belum mencakup semua entitas target.
