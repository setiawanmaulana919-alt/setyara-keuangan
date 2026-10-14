alter table public.wallets
  add column if not exists monthly_admin_fee bigint not null default 0
    check (monthly_admin_fee >= 0);

alter table public.wallet_transfers
  add column if not exists transfer_fee bigint not null default 0
    check (transfer_fee >= 0);

create table if not exists public.wallet_monthly_fee_records (
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  fee_month date not null,
  transaction_id uuid not null references public.financial_transactions(id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wallet_id, fee_month)
);

alter table public.wallet_monthly_fee_records enable row level security;

create or replace function public.apply_monthly_wallet_fees()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_row public.wallets%rowtype;
  fee_month date := date_trunc('month', current_date)::date;
  category_id uuid;
  transaction_id uuid;
begin
  for wallet_row in
    select wallet.*
    from public.wallets wallet
    where not wallet.is_archived
      and wallet.monthly_admin_fee > 0
      and public.can_access_scope(wallet.owner_user_id, wallet.family_id)
  loop
    select category.id
    into category_id
    from public.categories category
    where category.category_type::text = 'expense'
      and lower(trim(category.name)) = 'lainnya'
      and category.owner_user_id is not distinct from wallet_row.owner_user_id
      and category.family_id is not distinct from wallet_row.family_id
      and not category.is_archived
    limit 1;

    if category_id is null then
      continue;
    end if;

    transaction_id := gen_random_uuid();
    insert into public.financial_transactions (
      id, owner_user_id, family_id, account_id, category_id,
      transaction_type, amount, transaction_date, description, created_by
    )
    values (
      transaction_id, wallet_row.owner_user_id, wallet_row.family_id,
      wallet_row.id, category_id, 'expense', wallet_row.monthly_admin_fee,
      fee_month, 'Biaya admin bulanan: ' || wallet_row.name,
      coalesce(wallet_row.owner_user_id, auth.uid())
    );

    insert into public.wallet_monthly_fee_records (
      wallet_id, fee_month, transaction_id
    )
    values (wallet_row.id, fee_month, transaction_id)
    on conflict (wallet_id, fee_month) do nothing;
  end loop;
end;
$$;

grant execute on function public.apply_monthly_wallet_fees() to authenticated;

do $$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.wallet_balance_for_guard(uuid)'::regprocedure
  );
  definition := replace(
    definition,
    'then -transfer.amount',
    'then -(transfer.amount + transfer.transfer_fee)'
  );
  execute definition;
end;
$$;

do $$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.get_account_balances()'::regprocedure
  );
  definition := replace(
    definition,
    '-transfer.amount as amount',
    '-(transfer.amount + transfer.transfer_fee) as amount'
  );
  definition := replace(
    definition,
    'else -transfer.amount',
    'else -(transfer.amount + transfer.transfer_fee)'
  );
  execute definition;
end;
$$;

do $$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.prevent_negative_wallet_balance()'::regprocedure
  );
  definition := replace(
    definition,
    'balance_change := balance_change + old.amount;',
    'balance_change := balance_change + old.amount + old.transfer_fee;'
  );
  definition := replace(
    definition,
    'balance_change := balance_change - new.amount;',
    'balance_change := balance_change - new.amount - new.transfer_fee;'
  );
  execute definition;
end;
$$;
