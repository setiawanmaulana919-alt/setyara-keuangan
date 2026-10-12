-- Wallet and category schema, validation, and policies.

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  account_type public.account_type not null default 'other',
  opening_balance bigint not null default 0,
  opening_balance_date date not null default current_date,
  currency_code char(3) not null default 'IDR',
  is_archived boolean not null default false,
  investment_type text check (investment_type in ('gold', 'deposit', 'crypto', 'stock')),
  asset_symbol text,
  asset_quantity numeric,
  asset_unit text check (asset_unit in ('gram', 'kg', 'unit', 'lot')),
  purchase_price bigint,
  market_price bigint,
  market_updated_at timestamptz,
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
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((owner_user_id is not null)::int + (family_id is not null)::int = 1)
);

create index idx_wallets_owner on public.wallets(owner_user_id);

create index idx_wallets_family on public.wallets(family_id);

create index idx_categories_owner on public.categories(owner_user_id);

create index idx_categories_family on public.categories(family_id);

create trigger accounts_set_updated_at before update on public.wallets
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();

alter table public.wallets enable row level security;

alter table public.categories enable row level security;

create policy accounts_select_scope on public.wallets
for select to authenticated using (public.can_access_scope(owner_user_id, family_id));

create policy accounts_insert_scope on public.wallets
for insert to authenticated with check (public.can_write_scope(owner_user_id, family_id));

create policy accounts_update_scope on public.wallets
for update to authenticated using (public.can_write_scope(owner_user_id, family_id))
with check (public.can_write_scope(owner_user_id, family_id));

create policy accounts_delete_scope on public.wallets
for delete to authenticated using (public.can_write_scope(owner_user_id, family_id));

create policy categories_select_scope on public.categories
for select to authenticated using (public.can_access_scope(owner_user_id, family_id));

create policy categories_insert_scope on public.categories
for insert to authenticated with check (public.can_write_scope(owner_user_id, family_id));

create policy categories_update_scope on public.categories
for update to authenticated using (public.can_write_scope(owner_user_id, family_id))
with check (public.can_write_scope(owner_user_id, family_id));

create policy categories_delete_scope on public.categories
for delete to authenticated using (public.can_write_scope(owner_user_id, family_id));
