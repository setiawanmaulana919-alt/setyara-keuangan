-- Cross-feature reporting RPCs, privileges, and final API refresh.

revoke all on function public.lookup_login_email(text) from public;

grant execute on function public.lookup_login_email(text) to anon, authenticated;

grant usage on schema public to authenticated;

grant select, insert, update on table public.profiles to authenticated;

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.wallets,
  public.categories,
  public.financial_transactions,
  public.wallet_transfers
to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['wallets', 'categories', 'financial_transactions', 'wallet_transfers']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end $$;

grant select, insert, update, delete on table
  public.spending_budgets,
  public.assets,
  public.asset_valuation_history,
  public.savings_goals,
  public.savings_goal_contributions
to authenticated;

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.families,
  public.family_memberships
to authenticated;

grant select, insert, update, delete on table
  public.family_invitations
to service_role;

grant select on table public.family_invitations to authenticated;

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.family_memberships
to service_role;

revoke all on function public.get_transaction_period_totals(date, date, boolean)
  from public;

grant execute on function public.get_transaction_period_totals(date, date, boolean)
  to authenticated;

revoke all on function public.get_goal_contribution_totals() from public;

grant execute on function public.get_goal_contribution_totals() to authenticated;

revoke all on function public.get_goal_contribution_total(uuid) from public;

grant execute on function public.get_goal_contribution_total(uuid) to authenticated;

revoke all on function public.list_asset_summaries() from public;

grant execute on function public.list_asset_summaries() to authenticated;

revoke all on table public.loans, public.loan_payments
  from anon, authenticated;

grant select on table public.loans, public.loan_payments
  to authenticated;

revoke all on function public.create_loan_record(
  text, text, bigint, uuid, date, date, text
) from public;

grant execute on function public.create_loan_record(
  text, text, bigint, uuid, date, date, text
) to authenticated;

revoke all on function public.record_loan_repayment(
  uuid, uuid, bigint, date, text
) from public;

grant execute on function public.record_loan_repayment(
  uuid, uuid, bigint, date, text
) to authenticated;

revoke all on function public.list_loan_records() from public;

grant execute on function public.list_loan_records() to authenticated;

create or replace function public.get_account_balances()
returns table (
  account_id uuid,
  balance numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with active_accounts as (
    select
      account.id,
      account.opening_balance,
      account.account_type,
      account.market_price,
      account.asset_quantity,
      account.asset_unit,
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
      end as starting_balance
    from public.wallets account
    where account.is_archived = false
  ),
  transaction_totals as (
    select
      transaction.account_id,
      sum(case
        when transaction.transaction_type = 'income'
          then transaction.amount
        else -transaction.amount
      end) as amount
    from public.financial_transactions transaction
    join active_accounts account on account.id = transaction.account_id
    where transaction.deleted_at is null
    group by transaction.account_id
  ),
  transfer_movements as (
    select transfer.from_account_id as account_id, -transfer.amount as amount
    from public.wallet_transfers transfer
    join active_accounts account on account.id = transfer.from_account_id
    where transfer.deleted_at is null

    union all

    select transfer.to_account_id as account_id, transfer.amount
    from public.wallet_transfers transfer
    join active_accounts account on account.id = transfer.to_account_id
    where transfer.deleted_at is null
  ),
  transfer_totals as (
    select movement.account_id, sum(movement.amount) as amount
    from transfer_movements movement
    group by movement.account_id
  ),
  loan_movements as (
    select
      loan.account_id,
      case loan.direction
        when 'receivable' then -loan.principal_amount
        else loan.principal_amount
      end as amount
    from public.loans loan
    join active_accounts account on account.id = loan.account_id

    union all

    select
      repayment.account_id,
      case loan.direction
        when 'receivable' then repayment.amount
        else -repayment.amount
      end as amount
    from public.loan_payments repayment
    join public.loans loan on loan.id = repayment.loan_id
    join active_accounts account on account.id = repayment.account_id
  ),
  loan_totals as (
    select movement.account_id, sum(movement.amount) as amount
    from loan_movements movement
    group by movement.account_id
  )
  select
    account.id,
    account.starting_balance
      + coalesce(transaction.amount, 0)
      + coalesce(transfer.amount, 0)
      + coalesce(loan.amount, 0) as balance
  from active_accounts account
  left join transaction_totals transaction on transaction.account_id = account.id
  left join transfer_totals transfer on transfer.account_id = account.id
  left join loan_totals loan on loan.account_id = account.id;
$$;

revoke all on function public.get_account_balances() from public;

grant execute on function public.get_account_balances() to authenticated;

revoke all on function public.update_loan_record(
  uuid, text, text, bigint, uuid, date, date, text
) from public;

grant execute on function public.update_loan_record(
  uuid, text, text, bigint, uuid, date, date, text
) to authenticated;

revoke all on function public.delete_loan_record(uuid) from public;

grant execute on function public.delete_loan_record(uuid) to authenticated;

revoke all on public.goal_operation_requests from anon, authenticated;

revoke all on function public.add_goal_contribution(uuid, uuid, bigint, uuid, uuid, date)
  from public, anon;

grant execute on function public.add_goal_contribution(uuid, uuid, bigint, uuid, uuid, date)
  to authenticated;

revoke all on function public.reduce_goal_contribution(uuid, uuid, bigint, uuid, uuid, date)
  from public, anon;

grant execute on function public.reduce_goal_contribution(uuid, uuid, bigint, uuid, uuid, date)
  to authenticated;

revoke all on function public.prevent_goal_transaction_mutation()
  from public, anon, authenticated;

create function public.get_family_member_finance_summary(
  target_family_id uuid
)
returns table (
  user_id uuid,
  total_balance bigint,
  source_total bigint,
  investment_total bigint,
  receivable_total bigint,
  source_count bigint,
  investment_count bigint,
  receivable_count bigint,
  loan_receivable_total bigint,
  loan_payable_total bigint,
  loan_receivable_count bigint,
  loan_payable_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized_family as (
    select 1
    from public.family_memberships
    where family_id = target_family_id
      and user_id = auth.uid()
      and status = 'active'
  ),
  account_values as (
    select
      account.owner_user_id as user_id,
      account.account_type,
      (
        case
          when account.account_type = 'investment'
            and account.market_price is not null
            and account.asset_quantity is not null
            then round(
              account.market_price * account.asset_quantity
              * case
                  when account.asset_unit = 'lot' then 100
                  when account.asset_unit = 'kg' then 1000
                  else 1
                end
            )
          else account.opening_balance
        end
        + coalesce((
          select sum(
            case
              when tx.transaction_type = 'income' then tx.amount
              else -tx.amount
            end
          )
          from public.financial_transactions tx
          where tx.account_id = account.id
            and tx.deleted_at is null
        ), 0)
        + coalesce((
          select sum(case
            when transfer.to_account_id = account.id then transfer.amount
            else -transfer.amount
          end)
          from public.wallet_transfers transfer
          where (transfer.from_account_id = account.id
            or transfer.to_account_id = account.id)
            and transfer.deleted_at is null
        ), 0)
        + coalesce((
          select sum(case loan.direction
            when 'receivable' then -loan.principal_amount
            else loan.principal_amount
          end)
          from public.loans loan
          where loan.owner_user_id = account.owner_user_id
            and loan.account_id = account.id
        ), 0)
        + coalesce((
          select sum(case loan.direction
            when 'receivable' then payment.amount
            else -payment.amount
          end)
          from public.loan_payments payment
          join public.loans loan on loan.id = payment.loan_id
          where loan.owner_user_id = account.owner_user_id
            and payment.account_id = account.id
        ), 0)
      )::bigint as value
    from public.wallets account
    join public.family_memberships member
      on member.user_id = account.owner_user_id
      and member.family_id = target_family_id
      and member.status = 'active'
    where account.family_id is null
      and account.is_archived = false
  ),
  loan_totals as (
    select
      loan.owner_user_id as user_id,
      coalesce(sum(
        case when loan.direction = 'receivable'
          then loan.principal_amount - coalesce(repayment.amount, 0)
          else 0
        end
      ), 0)::bigint as receivable_total,
      coalesce(sum(
        case when loan.direction = 'payable'
          then loan.principal_amount - coalesce(repayment.amount, 0)
          else 0
        end
      ), 0)::bigint as payable_total,
      count(*) filter (where loan.direction = 'receivable')::bigint
        as receivable_count,
      count(*) filter (where loan.direction = 'payable')::bigint
        as payable_count
    from public.loans loan
    join public.family_memberships member
      on member.user_id = loan.owner_user_id
      and member.family_id = target_family_id
      and member.status = 'active'
    left join lateral (
      select sum(payment.amount)::bigint as amount
      from public.loan_payments payment
      where payment.loan_id = loan.id
    ) repayment on true
    group by loan.owner_user_id
  ),
  member_accounts as (
    select
      member.user_id,
      coalesce(sum(case
        when account.account_type = 'receivable' then -account.value
        else account.value
      end), 0)::bigint as account_total,
      coalesce(sum(case
        when account.account_type not in ('investment', 'receivable')
          then account.value else 0
      end), 0)::bigint as source_total,
      coalesce(sum(case
        when account.account_type = 'investment' then account.value else 0
      end), 0)::bigint as investment_total,
      coalesce(sum(case
        when account.account_type = 'receivable' then account.value else 0
      end), 0)::bigint as receivable_total,
      count(account.user_id) filter (
        where account.account_type not in ('investment', 'receivable')
      )::bigint as source_count,
      count(account.user_id) filter (
        where account.account_type = 'investment'
      )::bigint as investment_count,
      count(account.user_id) filter (
        where account.account_type = 'receivable'
      )::bigint as receivable_count
    from public.family_memberships member
    left join account_values account on account.user_id = member.user_id
    where member.family_id = target_family_id
      and member.status = 'active'
    group by member.user_id
  )
  select
    member_accounts.user_id,
    (
      member_accounts.account_total
      + coalesce(loan.receivable_total, 0)
      - coalesce(loan.payable_total, 0)
    )::bigint as total_balance,
    member_accounts.source_total,
    member_accounts.investment_total,
    member_accounts.receivable_total,
    member_accounts.source_count,
    member_accounts.investment_count,
    member_accounts.receivable_count,
    coalesce(loan.receivable_total, 0)::bigint,
    coalesce(loan.payable_total, 0)::bigint,
    coalesce(loan.receivable_count, 0)::bigint,
    coalesce(loan.payable_count, 0)::bigint
  from member_accounts
  left join loan_totals loan on loan.user_id = member_accounts.user_id
  where exists (select 1 from authorized_family);
$$;

revoke all on function public.get_family_member_finance_summary(uuid) from public;

grant execute on function public.get_family_member_finance_summary(uuid) to authenticated;

revoke all on public.loan_operation_requests from anon, authenticated;

revoke all on function public.create_loan_record(
  text, text, bigint, uuid, date, date, text
) from public, anon, authenticated;

revoke all on function public.record_loan_repayment(
  uuid, uuid, bigint, date, text
) from public, anon, authenticated;

revoke all on function public.create_loan_record_idempotent(
  uuid, text, text, bigint, uuid, date, date, text
) from public, anon;

grant execute on function public.create_loan_record_idempotent(
  uuid, text, text, bigint, uuid, date, date, text
) to authenticated;

revoke all on function public.record_loan_repayment_idempotent(
  uuid, uuid, uuid, bigint, date, text
) from public, anon;

grant execute on function public.record_loan_repayment_idempotent(
  uuid, uuid, uuid, bigint, date, text
) to authenticated;

revoke all on public.goal_transaction_cleanup
  from public, anon, authenticated;

revoke all on public.transaction_delete_tombstones
  from public, anon, authenticated;

create or replace function public.prevent_deleted_transaction_replay()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.transaction_delete_tombstones tombstone
    where tombstone.transaction_id = new.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'This transaction request was already deleted.';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_prevent_deleted_replay
  on public.financial_transactions;

create trigger transactions_prevent_deleted_replay
before insert on public.financial_transactions
for each row execute function public.prevent_deleted_transaction_replay();

revoke all on function public.prevent_deleted_transaction_replay()
  from public, anon, authenticated;

create or replace function public.delete_transaction(
  target_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  transaction_row public.financial_transactions%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication is required';
  end if;

  select * into transaction_row
  from public.financial_transactions
  where id = target_transaction_id
  for update;

  if not found then
    return;
  end if;

  if not public.can_write_scope(
    transaction_row.owner_user_id, transaction_row.family_id
  ) then
    raise exception 'Transaction cannot be deleted.';
  end if;

  if exists (
    select 1
    from public.savings_goal_contributions contribution
    where contribution.transaction_id = target_transaction_id
  ) or exists (
    select 1
    from public.goal_operation_requests request
    where request.transaction_id = target_transaction_id
  ) then
    raise exception 'Transactions generated by goal progress must be deleted from the goal.';
  end if;

  insert into public.transaction_delete_tombstones (transaction_id)
  values (target_transaction_id)
  on conflict (transaction_id) do nothing;

  delete from public.financial_transactions
  where id = target_transaction_id;
end;
$$;

revoke all on function public.delete_transaction(uuid) from public, anon;

grant execute on function public.delete_transaction(uuid) to authenticated;

revoke all on function public.delete_savings_goal(uuid) from public, anon;

grant execute on function public.delete_savings_goal(uuid) to authenticated;

revoke all on function public.list_loan_records() from public;

grant execute on function public.list_loan_records() to authenticated;

notify pgrst, 'reload schema';
