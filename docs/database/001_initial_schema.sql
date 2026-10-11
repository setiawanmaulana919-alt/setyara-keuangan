-- Initial PostgreSQL schema for Supabase.
-- This is a reviewed starting point, not a complete production migration.
-- Apply to a development/staging project first and test RLS before production.
-- Amounts are integer IDR. Do not use floating-point for money.

create extension if not exists pgcrypto;

create type public.transaction_type as enum ('income', 'expense');
create type public.category_type as enum ('income', 'expense');
create type public.account_type as enum ('cash', 'bank', 'e_wallet', 'savings', 'other');
create type public.family_role as enum ('owner', 'editor', 'viewer');
create type public.membership_status as enum ('active', 'invited', 'removed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.family_role not null default 'viewer',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  account_type public.account_type not null default 'other',
  opening_balance bigint not null default 0,
  opening_balance_date date not null default current_date,
  currency_code char(3) not null default 'IDR',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((owner_user_id is not null)::int + (family_id is not null)::int = 1)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  category_type public.category_type not null,
  icon text,
  color text,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((owner_user_id is not null)::int + (family_id is not null)::int = 1)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  transaction_type public.transaction_type not null,
  amount bigint not null check (amount > 0),
  transaction_date date not null default current_date,
  description text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((owner_user_id is not null)::int + (family_id is not null)::int = 1)
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id) on delete restrict,
  to_account_id uuid not null references public.accounts(id) on delete restrict,
  amount bigint not null check (amount > 0),
  transfer_date date not null default current_date,
  description text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (from_account_id <> to_account_id),
  check ((owner_user_id is not null)::int + (family_id is not null)::int = 1)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  name text,
  amount_limit bigint not null check (amount_limit > 0),
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check ((owner_user_id is not null)::int + (family_id is not null)::int = 1)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  asset_type text not null,
  quantity numeric(20,6),
  acquisition_value bigint not null default 0 check (acquisition_value >= 0),
  acquisition_date date,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((owner_user_id is not null)::int + (family_id is not null)::int = 1)
);

create table public.asset_valuations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  valuation_date date not null,
  market_value bigint not null check (market_value >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (asset_id, valuation_date)
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  target_amount bigint not null check (target_amount > 0),
  target_date date,
  notes text,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((owner_user_id is not null)::int + (family_id is not null)::int = 1)
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  amount bigint not null check (amount > 0),
  contribution_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_accounts_owner on public.accounts(owner_user_id);
create index idx_accounts_family on public.accounts(family_id);
create index idx_categories_owner on public.categories(owner_user_id);
create index idx_categories_family on public.categories(family_id);
create index idx_transactions_owner_date on public.transactions(owner_user_id, transaction_date desc);
create index idx_transactions_family_date on public.transactions(family_id, transaction_date desc);
create index idx_transactions_account_date on public.transactions(account_id, transaction_date desc);
create index idx_transfers_owner_date on public.transfers(owner_user_id, transfer_date desc);
create index idx_transfers_family_date on public.transfers(family_id, transfer_date desc);
create index idx_budgets_owner_period on public.budgets(owner_user_id, period_start, period_end);
create index idx_budgets_family_period on public.budgets(family_id, period_start, period_end);
create index idx_family_members_user on public.family_members(user_id, status);

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger families_set_updated_at before update on public.families
for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at before update on public.accounts
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
for each row execute function public.set_updated_at();
create trigger transfers_set_updated_at before update on public.transfers
for each row execute function public.set_updated_at();
create trigger budgets_set_updated_at before update on public.budgets
for each row execute function public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets
for each row execute function public.set_updated_at();
create trigger savings_goals_set_updated_at before update on public.savings_goals
for each row execute function public.set_updated_at();

-- IMPORTANT:
-- This migration intentionally does NOT enable RLS with incomplete policies.
-- Before exposing any table through Supabase APIs:
-- 1) enable RLS on every client-accessible table;
-- 2) implement policies for personal ownership and active family membership/role;
-- 3) validate account/category/goal scope consistency;
-- 4) test as authenticated users with different roles.
-- Do not deploy this schema to production until policies and cross-scope constraints are complete.
