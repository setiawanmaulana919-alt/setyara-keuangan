-- Transaction and transfer schema, integrity, and policies.

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  account_id uuid not null references public.wallets(id) on delete restrict,
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

create table public.wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  from_account_id uuid not null references public.wallets(id) on delete restrict,
  to_account_id uuid not null references public.wallets(id) on delete restrict,
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

create index idx_financial_transactions_owner_date on public.financial_transactions(owner_user_id, transaction_date desc);

create index idx_financial_transactions_family_date on public.financial_transactions(family_id, transaction_date desc);

create index idx_financial_transactions_wallet_date on public.financial_transactions(account_id, transaction_date desc);

create index idx_wallet_transfers_owner_date on public.wallet_transfers(owner_user_id, transfer_date desc);

create index idx_wallet_transfers_family_date on public.wallet_transfers(family_id, transfer_date desc);

create trigger transactions_set_updated_at before update on public.financial_transactions
for each row execute function public.set_updated_at();

create trigger transfers_set_updated_at before update on public.wallet_transfers
for each row execute function public.set_updated_at();

create or replace function public.validate_account_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  account_owner uuid;
  account_family uuid;
begin
  select owner_user_id, family_id
  into account_owner, account_family
  from public.wallets
  where id = new.account_id;

  if account_owner is null and account_family is null then
    raise exception 'Referenced account does not exist';
  end if;

  if new.owner_user_id is distinct from account_owner
     or new.family_id is distinct from account_family then
    raise exception 'Record scope does not match account scope';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_validate_account_scope on public.financial_transactions;

create trigger transactions_validate_account_scope
before insert or update on public.financial_transactions
for each row execute function public.validate_account_scope();

create or replace function public.validate_transaction_category_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  category_owner uuid;
  category_family uuid;
  category_kind public.category_type;
begin
  select owner_user_id, family_id, category_type
  into category_owner, category_family, category_kind
  from public.categories
  where id = new.category_id;

  if category_owner is null and category_family is null then
    raise exception 'Referenced category does not exist';
  end if;

  if new.owner_user_id is distinct from category_owner
     or new.family_id is distinct from category_family
     or category_kind::text <> new.transaction_type::text then
    raise exception 'Transaction category scope or type does not match';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_validate_category_scope on public.financial_transactions;

create trigger transactions_validate_category_scope
before insert or update on public.financial_transactions
for each row execute function public.validate_transaction_category_scope();

create or replace function public.validate_transfer_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  from_owner uuid;
  from_family uuid;
  to_owner uuid;
  to_family uuid;
begin
  select owner_user_id, family_id into from_owner, from_family
  from public.wallets where id = new.from_account_id;
  select owner_user_id, family_id into to_owner, to_family
  from public.wallets where id = new.to_account_id;

  if from_owner is null and from_family is null
     or to_owner is null and to_family is null then
    raise exception 'Transfer account does not exist';
  end if;

  if from_owner is distinct from to_owner
     or from_family is distinct from to_family
     or new.owner_user_id is distinct from from_owner
     or new.family_id is distinct from from_family then
    raise exception 'Transfer scope does not match account scope';
  end if;

  return new;
end;
$$;

drop trigger if exists transfers_validate_scope on public.wallet_transfers;

create trigger transfers_validate_scope
before insert or update on public.wallet_transfers
for each row execute function public.validate_transfer_scope();

alter table public.financial_transactions enable row level security;

alter table public.wallet_transfers enable row level security;

create policy transactions_select_scope on public.financial_transactions
for select to authenticated using (public.can_access_scope(owner_user_id, family_id));

create policy transactions_insert_scope on public.financial_transactions
for insert to authenticated with check (
  created_by = auth.uid() and public.can_write_scope(owner_user_id, family_id)
);

create policy transactions_update_scope on public.financial_transactions
for update to authenticated using (public.can_write_scope(owner_user_id, family_id))
with check (public.can_write_scope(owner_user_id, family_id));

create policy transactions_delete_scope on public.financial_transactions
for delete to authenticated using (public.can_write_scope(owner_user_id, family_id));

create policy transfers_select_scope on public.wallet_transfers
for select to authenticated using (public.can_access_scope(owner_user_id, family_id));

create policy transfers_insert_scope on public.wallet_transfers
for insert to authenticated with check (
  created_by = auth.uid() and public.can_write_scope(owner_user_id, family_id)
);

create policy transfers_update_scope on public.wallet_transfers
for update to authenticated using (public.can_write_scope(owner_user_id, family_id))
with check (public.can_write_scope(owner_user_id, family_id));

create policy transfers_delete_scope on public.wallet_transfers
for delete to authenticated using (public.can_write_scope(owner_user_id, family_id));

create or replace function public.get_transaction_period_totals(
  start_date date,
  end_date date,
  group_by_month boolean default false
)
returns table (
  period_start date,
  transaction_type text,
  category_id uuid,
  amount bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped_transactions as (
    select
      tx.transaction_date,
      tx.transaction_type::text as transaction_type,
      tx.category_id,
      tx.amount
    from public.financial_transactions tx
    where tx.deleted_at is null
      and tx.transaction_date between start_date and end_date
  ),
  period_transactions as (
    select
      case
        when group_by_month
          then date_trunc('month', transaction_date::timestamp)::date
        else transaction_date
      end as period_start,
      transaction_type,
      category_id,
      amount
    from scoped_transactions
  )
  select
    period_tx.period_start,
    'income'::text,
    null::uuid,
    sum(period_tx.amount)::bigint
  from period_transactions period_tx
  where period_tx.transaction_type = 'income'
  group by period_tx.period_start

  union all

  select
    period_tx.period_start,
    'expense'::text,
    period_tx.category_id,
    sum(period_tx.amount)::bigint
  from period_transactions period_tx
  where period_tx.transaction_type = 'expense'
  group by period_tx.period_start, period_tx.category_id;
$$;

create index if not exists idx_transactions_active_date
  on public.financial_transactions (transaction_date)
  where deleted_at is null;

create index if not exists idx_wallet_transfers_active_from_wallet
  on public.wallet_transfers (from_account_id)
  where deleted_at is null;

create index if not exists idx_wallet_transfers_active_to_wallet
  on public.wallet_transfers (to_account_id)
  where deleted_at is null;

create index if not exists idx_financial_transactions_active_activity_order
  on public.financial_transactions (transaction_date desc, id desc)
  where deleted_at is null;

create index if not exists idx_financial_transactions_active_description_trgm
  on public.financial_transactions using gin (description extensions.gin_trgm_ops)
  where deleted_at is null;

drop index if exists public.idx_transactions_active_date;

create index if not exists idx_financial_transactions_active_wallet
  on public.financial_transactions (account_id)
  include (transaction_type, amount)
  where deleted_at is null;

create table public.transaction_delete_tombstones (
  transaction_id uuid primary key,
  deleted_at timestamptz not null default now()
);

alter table public.transaction_delete_tombstones enable row level security;
