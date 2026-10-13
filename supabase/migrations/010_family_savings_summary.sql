begin;

drop function public.get_family_member_finance_summary(uuid);

create function public.get_family_member_finance_summary(
  target_family_id uuid
)
returns table (
  user_id uuid,
  total_balance bigint,
  source_total bigint,
  savings_total bigint,
  investment_total bigint,
  receivable_total bigint,
  source_count bigint,
  savings_count bigint,
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
        when account.account_type not in ('investment', 'receivable', 'savings')
          then account.value else 0
      end), 0)::bigint as source_total,
      coalesce(sum(case
        when account.account_type = 'savings' then account.value else 0
      end), 0)::bigint as savings_total,
      coalesce(sum(case
        when account.account_type = 'investment' then account.value else 0
      end), 0)::bigint as investment_total,
      coalesce(sum(case
        when account.account_type = 'receivable' then account.value else 0
      end), 0)::bigint as receivable_total,
      count(account.user_id) filter (
        where account.account_type not in ('investment', 'receivable', 'savings')
      )::bigint as source_count,
      count(account.user_id) filter (
        where account.account_type = 'savings'
      )::bigint as savings_count,
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
    member_accounts.savings_total,
    member_accounts.investment_total,
    member_accounts.receivable_total,
    member_accounts.source_count,
    member_accounts.savings_count,
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

commit;
