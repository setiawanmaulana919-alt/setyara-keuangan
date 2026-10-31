create or replace function public.apply_monthly_wallet_fees()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_row public.wallets%rowtype;
  current_fee_month date := date_trunc('month', current_date)::date;
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
    perform pg_advisory_xact_lock(hashtextextended(wallet_row.id::text, 0));

    if exists (
      select 1
      from public.wallet_monthly_fee_records record
      where record.wallet_id = wallet_row.id
        and record.fee_month = current_fee_month
    ) then
      continue;
    end if;

    if coalesce(public.wallet_balance_for_guard(wallet_row.id), 0)
      < wallet_row.monthly_admin_fee then
      continue;
    end if;

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
      current_fee_month, 'Biaya admin bulanan: ' || wallet_row.name,
      coalesce(wallet_row.owner_user_id, auth.uid())
    );

    insert into public.wallet_monthly_fee_records (
      wallet_id, fee_month, transaction_id
    )
    values (wallet_row.id, current_fee_month, transaction_id);
  end loop;
end;
$$;

grant execute on function public.apply_monthly_wallet_fees() to authenticated;
