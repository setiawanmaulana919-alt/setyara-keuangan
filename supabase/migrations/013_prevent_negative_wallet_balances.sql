create or replace function public.wallet_balance_for_guard(target_wallet_id uuid)
returns numeric
language sql
volatile
security definer
set search_path = public
as $$
  select
    case
      when account.account_type::text = 'investment'
        and account.market_price is not null
        and account.asset_quantity is not null
        then account.market_price * account.asset_quantity
          * case
              when account.asset_unit = 'lot' then 100
              when account.asset_unit = 'kg' then 1000
              else 1
            end
      else account.opening_balance
    end
    + coalesce((
      select sum(case
        when transaction.transaction_type = 'income'
          then transaction.amount
        else -transaction.amount
      end)
      from public.financial_transactions transaction
      where transaction.account_id = account.id
        and transaction.deleted_at is null
    ), 0)
    + coalesce((
      select sum(movement.amount)
      from (
        select
          case
            when transfer.from_account_id = account.id then -transfer.amount
            else transfer.amount
          end as amount
        from public.wallet_transfers transfer
        where transfer.deleted_at is null
          and (transfer.from_account_id = account.id
            or transfer.to_account_id = account.id)
      ) movement
    ), 0)
    + coalesce((
      select sum(case
        when loan.direction = 'receivable' then -loan.principal_amount
        else loan.principal_amount
      end)
      from public.loans loan
      where loan.account_id = account.id
    ), 0)
    + coalesce((
      select sum(case
        when loan.direction = 'receivable' then repayment.amount
        else -repayment.amount
      end)
      from public.loan_payments repayment
      join public.loans loan on loan.id = repayment.loan_id
      where repayment.account_id = account.id
    ), 0)
  from public.wallets account
  where account.id = target_wallet_id;
$$;

create or replace function public.prevent_negative_wallet_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_account_ids uuid[] := array[]::uuid[];
  target_account_id uuid;
  account_name text;
  current_balance numeric;
  balance_change numeric;
  repayment_change numeric;
  old_loan_direction text;
  new_loan_direction text;
begin
  if tg_table_name = 'wallets' then
    if tg_op = 'UPDATE' then
      affected_account_ids := array_append(affected_account_ids, new.id);
    else
      if new.opening_balance < 0
        or (new.account_type::text = 'investment'
          and new.market_price is not null
          and new.asset_quantity is not null
          and new.market_price * new.asset_quantity
            * case
                when new.asset_unit = 'lot' then 100
                when new.asset_unit = 'kg' then 1000
                else 1
              end < 0)
      then
        raise exception 'Saldo awal akun tidak boleh negatif.';
      end if;
      return new;
    end if;
  elsif tg_table_name = 'financial_transactions' then
    if tg_op <> 'INSERT' then
      affected_account_ids := array_append(affected_account_ids, old.account_id);
    end if;
    if tg_op <> 'DELETE' then
      affected_account_ids := array_append(affected_account_ids, new.account_id);
    end if;
  elsif tg_table_name = 'wallet_transfers' then
    if tg_op <> 'INSERT' then
      affected_account_ids := array_append(
        affected_account_ids, old.from_account_id, old.to_account_id
      );
    end if;
    if tg_op <> 'DELETE' then
      affected_account_ids := array_append(
        affected_account_ids, new.from_account_id, new.to_account_id
      );
    end if;
  elsif tg_table_name = 'loans' then
    if tg_op <> 'INSERT' then
      select coalesce(array_agg(distinct account_id), array[]::uuid[])
      into affected_account_ids
      from public.loan_payments
      where loan_id = old.id;
      affected_account_ids := array_append(affected_account_ids, old.account_id);
    end if;
    if tg_op <> 'DELETE' then
      affected_account_ids := array_append(affected_account_ids, new.account_id);
    end if;
  elsif tg_table_name = 'loan_payments' then
    if tg_op <> 'INSERT' then
      affected_account_ids := array_append(affected_account_ids, old.account_id);
    end if;
    if tg_op <> 'DELETE' then
      affected_account_ids := array_append(affected_account_ids, new.account_id);
    end if;
  end if;

  perform account.id
  from public.wallets account
  where account.id = any(affected_account_ids)
  order by account.id
  for update;

  for target_account_id in
    select distinct affected.id
    from unnest(affected_account_ids) as affected(id)
    where affected.id is not null
    order by affected.id
  loop
    select account.name
    into account_name
    from public.wallets account
    where account.id = target_account_id;

    current_balance :=
      public.wallet_balance_for_guard(target_account_id);
    if current_balance is null then
      continue;
    end if;

    balance_change := 0;
    if tg_table_name = 'wallets' then
      balance_change :=
        case
          when new.account_type::text = 'investment'
            and new.market_price is not null
            and new.asset_quantity is not null
            then new.market_price * new.asset_quantity
              * case
                  when new.asset_unit = 'lot' then 100
                  when new.asset_unit = 'kg' then 1000
                  else 1
                end
          else new.opening_balance
        end
        - case
            when old.account_type::text = 'investment'
              and old.market_price is not null
              and old.asset_quantity is not null
              then old.market_price * old.asset_quantity
                * case
                    when old.asset_unit = 'lot' then 100
                    when old.asset_unit = 'kg' then 1000
                    else 1
                  end
            else old.opening_balance
          end;
    elsif tg_table_name = 'financial_transactions' then
      if tg_op <> 'INSERT' and old.account_id = target_account_id
        and old.deleted_at is null
      then
        balance_change := balance_change - case
          when old.transaction_type = 'income' then old.amount
          else -old.amount
        end;
      end if;
      if tg_op <> 'DELETE' and new.account_id = target_account_id
        and new.deleted_at is null
      then
        balance_change := balance_change + case
          when new.transaction_type = 'income' then new.amount
          else -new.amount
        end;
      end if;
    elsif tg_table_name = 'wallet_transfers' then
      if tg_op <> 'INSERT' and old.deleted_at is null then
        if old.from_account_id = target_account_id then
          balance_change := balance_change + old.amount;
        end if;
        if old.to_account_id = target_account_id then
          balance_change := balance_change - old.amount;
        end if;
      end if;
      if tg_op <> 'DELETE' and new.deleted_at is null then
        if new.from_account_id = target_account_id then
          balance_change := balance_change - new.amount;
        end if;
        if new.to_account_id = target_account_id then
          balance_change := balance_change + new.amount;
        end if;
      end if;
    elsif tg_table_name = 'loans' then
      if tg_op <> 'INSERT' then
        if old.account_id = target_account_id then
          balance_change := balance_change - case
            when old.direction = 'receivable' then -old.principal_amount
            else old.principal_amount
          end;
        end if;
        select coalesce(sum(case
          when old.direction = 'receivable' then -repayment.amount
          else repayment.amount
        end), 0)
        into repayment_change
        from public.loan_payments repayment
        where repayment.loan_id = old.id
          and repayment.account_id = target_account_id;
        balance_change := balance_change - repayment_change;
      end if;
      if tg_op <> 'DELETE' then
        if new.account_id = target_account_id then
          balance_change := balance_change + case
            when new.direction = 'receivable' then -new.principal_amount
            else new.principal_amount
          end;
        end if;
        select coalesce(sum(case
          when new.direction = 'receivable' then repayment.amount
          else -repayment.amount
        end), 0)
        into repayment_change
        from public.loan_payments repayment
        where repayment.loan_id = new.id
          and repayment.account_id = target_account_id;
        balance_change := balance_change + repayment_change;
      end if;
    elsif tg_table_name = 'loan_payments' then
      if tg_op <> 'INSERT' then
        select direction
        into old_loan_direction
        from public.loans
        where id = old.loan_id;
        if old_loan_direction is null then
          return old;
        end if;
        if old.account_id = target_account_id then
          balance_change := balance_change - case
            when old_loan_direction = 'receivable' then old.amount
            else -old.amount
          end;
        end if;
      end if;
      if tg_op <> 'DELETE' then
        select direction
        into new_loan_direction
        from public.loans
        where id = new.loan_id;
        if new_loan_direction is null then
          raise exception 'Catatan pinjaman tidak ditemukan.';
        end if;
        if new.account_id = target_account_id then
          balance_change := balance_change + case
            when new_loan_direction = 'receivable' then new.amount
            else -new.amount
          end;
        end if;
      end if;
    end if;

    if balance_change < 0 and current_balance + balance_change < 0 then
      raise exception
        'Saldo akun "%" tidak cukup. Saldo saat ini %, dan perubahan ini akan membuat saldo menjadi %. Gunakan akun sumber lain atau kurangi nominal.',
        account_name,
        current_balance,
        current_balance + balance_change;
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.wallet_balance_for_guard(uuid) from public;
revoke all on function public.prevent_negative_wallet_balance() from public;

create trigger wallets_prevent_negative_balance
before update of opening_balance, account_type, market_price, asset_quantity, asset_unit
on public.wallets
for each row execute function public.prevent_negative_wallet_balance();

create trigger wallets_prevent_negative_initial_balance
before insert on public.wallets
for each row execute function public.prevent_negative_wallet_balance();

create trigger transactions_prevent_negative_balance
before insert or update or delete on public.financial_transactions
for each row execute function public.prevent_negative_wallet_balance();

create trigger transfers_prevent_negative_balance
before insert or update or delete on public.wallet_transfers
for each row execute function public.prevent_negative_wallet_balance();

create trigger loans_prevent_negative_balance
before insert or update or delete on public.loans
for each row execute function public.prevent_negative_wallet_balance();

create trigger loan_payments_prevent_negative_balance
before insert or update or delete on public.loan_payments
for each row execute function public.prevent_negative_wallet_balance();
