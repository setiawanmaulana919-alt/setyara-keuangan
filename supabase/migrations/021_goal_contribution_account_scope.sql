create or replace function public.validate_goal_contribution_account_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  goal_family_id uuid;
begin
  if new.description like 'Tambah progres target:%'
     or new.description like 'Kurangi progres target:%' then
    select goal.family_id
    into goal_family_id
    from public.savings_goals goal
    where goal.name = trim(substring(new.description from 'target: (.*)$'))
    limit 1;

    if found and goal_family_id is not null
       and new.family_id is distinct from goal_family_id then
      raise exception 'Family goal contributions must use a family wallet';
    end if;

    if found and goal_family_id is null
       and (new.family_id is not null or new.owner_user_id is null) then
      raise exception 'Personal goal contributions must use a personal wallet';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_goal_contribution_account_scope
on public.financial_transactions;

create trigger validate_goal_contribution_account_scope
before insert on public.financial_transactions
for each row execute function public.validate_goal_contribution_account_scope();
