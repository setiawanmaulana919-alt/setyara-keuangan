-- Savings goal schema, contribution workflows, and policies.

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  target_amount bigint not null check (target_amount > 0),
  target_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((owner_user_id is not null)::int + (family_id is not null)::int = 1)
);

create table public.savings_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  transaction_id uuid references public.financial_transactions(id) on delete set null,
  amount bigint not null check (amount > 0),
  contribution_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create trigger savings_goals_set_updated_at before update on public.savings_goals
for each row execute function public.set_updated_at();

alter table public.savings_goals enable row level security;

alter table public.savings_goal_contributions enable row level security;

create policy savings_goals_select_scope on public.savings_goals
for select to authenticated using (public.can_access_scope(owner_user_id, family_id));

create policy savings_goals_insert_scope on public.savings_goals
for insert to authenticated with check (public.can_write_scope(owner_user_id, family_id));

create policy savings_goals_update_scope on public.savings_goals
for update to authenticated using (public.can_write_scope(owner_user_id, family_id))
with check (public.can_write_scope(owner_user_id, family_id));

create policy savings_goals_delete_scope on public.savings_goals
for delete to authenticated using (public.can_write_scope(owner_user_id, family_id));

create policy goal_contributions_select_scope on public.savings_goal_contributions
for select to authenticated using (
  exists (
    select 1 from public.savings_goals goal
    where goal.id = goal_id
      and public.can_access_scope(goal.owner_user_id, goal.family_id)
  )
);

create policy goal_contributions_insert_scope on public.savings_goal_contributions
for insert to authenticated with check (
  exists (
    select 1 from public.savings_goals goal
    where goal.id = goal_id
      and public.can_write_scope(goal.owner_user_id, goal.family_id)
  )
);

create policy goal_contributions_update_scope on public.savings_goal_contributions
for update to authenticated using (
  exists (
    select 1 from public.savings_goals goal
    where goal.id = goal_id
      and public.can_write_scope(goal.owner_user_id, goal.family_id)
  )
);

create policy goal_contributions_delete_scope on public.savings_goal_contributions
for delete to authenticated using (
  exists (
    select 1 from public.savings_goals goal
    where goal.id = goal_id
      and public.can_write_scope(goal.owner_user_id, goal.family_id)
  )
);

create or replace function public.get_goal_contribution_totals()
returns table (
  goal_id uuid,
  saved_amount bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select contribution.goal_id, sum(contribution.amount)::bigint
  from public.savings_goal_contributions contribution
  group by contribution.goal_id;
$$;

create index if not exists idx_savings_goal_contributions_goal_amount
  on public.savings_goal_contributions (goal_id)
  include (amount);

create index if not exists idx_savings_goal_contributions_goal_latest
  on public.savings_goal_contributions (
    goal_id,
    contribution_date desc,
    created_at desc,
    id desc
  )
  include (amount);

create or replace function public.get_goal_contribution_total(target_goal_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(amount), 0)::bigint
  from public.savings_goal_contributions
  where goal_id = target_goal_id;
$$;

create table public.goal_operation_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  operation text not null check (operation in ('add', 'reduce')),
  request_payload jsonb not null,
  transaction_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create or replace function public.add_goal_contribution(
  target_goal_id uuid,
  target_request_id uuid,
  target_amount bigint,
  target_account_id uuid,
  target_category_id uuid,
  target_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  goal_row public.savings_goals%rowtype;
  account_row public.wallets%rowtype;
  category_row public.categories%rowtype;
  request_payload jsonb;
  existing_request public.goal_operation_requests%rowtype;
  created_transaction_id uuid;
  rows_inserted integer;
begin
  if actor_id is null then
    raise exception 'Authentication is required';
  end if;
  if target_request_id is null or target_amount is null or target_amount <= 0
     or target_date is null then
    raise exception 'Invalid goal contribution input';
  end if;

  request_payload := jsonb_build_object(
    'goal_id', target_goal_id,
    'amount', target_amount,
    'account_id', target_account_id,
    'category_id', target_category_id,
    'date', target_date
  );
  insert into public.goal_operation_requests (
    user_id, request_id, operation, request_payload
  )
  values (actor_id, target_request_id, 'add', request_payload)
  on conflict (user_id, request_id) do nothing;
  get diagnostics rows_inserted = row_count;

  select * into existing_request
  from public.goal_operation_requests
  where user_id = actor_id
    and goal_operation_requests.request_id = target_request_id
  for update;
  if existing_request.operation <> 'add'
     or existing_request.request_payload <> request_payload then
    raise exception 'Request ID was already used for a different operation';
  end if;
  if rows_inserted = 0 and existing_request.transaction_id is null then
    raise exception 'Previously started request has no transaction result';
  end if;
  if existing_request.transaction_id is not null then
    return existing_request.transaction_id;
  end if;

  select * into goal_row
  from public.savings_goals
  where id = target_goal_id
  for update;
  if not found or not public.can_write_scope(
    goal_row.owner_user_id, goal_row.family_id
  ) then
    raise exception 'Goal is unavailable or cannot be changed';
  end if;

  select * into account_row
  from public.wallets
  where id = target_account_id and not is_archived;
  if not found or not public.can_write_scope(
    account_row.owner_user_id, account_row.family_id
  ) then
    raise exception 'Account is unavailable or cannot be changed';
  end if;
  if not (
    (goal_row.family_id is null
      and account_row.owner_user_id = goal_row.owner_user_id
      and account_row.family_id is null)
    or (goal_row.family_id is not null
      and (account_row.family_id = goal_row.family_id
        or (account_row.owner_user_id = actor_id
          and account_row.family_id is null)))
  ) then
    raise exception 'Account scope does not match goal scope';
  end if;

  select * into category_row
  from public.categories
  where id = target_category_id and not is_archived;
  if not found
     or category_row.owner_user_id is distinct from account_row.owner_user_id
     or category_row.family_id is distinct from account_row.family_id
     or category_row.category_type::text <> 'expense' then
    raise exception 'Category scope or type does not match contribution';
  end if;

  created_transaction_id := gen_random_uuid();
  insert into public.financial_transactions (
    id, owner_user_id, family_id, account_id, category_id,
    transaction_type, amount, transaction_date, description, created_by
  )
  values (
    created_transaction_id, account_row.owner_user_id, account_row.family_id,
    target_account_id, target_category_id, 'expense', target_amount,
    target_date, 'Tambah progres target: ' || goal_row.name, actor_id
  );

  insert into public.savings_goal_contributions (
    goal_id, transaction_id, amount, contribution_date
  )
  values (target_goal_id, created_transaction_id, target_amount, target_date);

  update public.goal_operation_requests
  set transaction_id = created_transaction_id
  where user_id = actor_id
    and goal_operation_requests.request_id = target_request_id;

  return created_transaction_id;
end;
$$;

create or replace function public.reduce_goal_contribution(
  target_goal_id uuid,
  target_request_id uuid,
  target_amount bigint,
  target_account_id uuid,
  target_category_id uuid,
  target_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  goal_row public.savings_goals%rowtype;
  account_row public.wallets%rowtype;
  category_row public.categories%rowtype;
  contribution_row public.savings_goal_contributions%rowtype;
  request_payload jsonb;
  existing_request public.goal_operation_requests%rowtype;
  created_transaction_id uuid;
  rows_inserted integer;
  remaining bigint;
  saved_total numeric;
begin
  if actor_id is null then
    raise exception 'Authentication is required';
  end if;
  if target_request_id is null or target_amount is null or target_amount <= 0
     or target_date is null then
    raise exception 'Invalid goal contribution input';
  end if;

  request_payload := jsonb_build_object(
    'goal_id', target_goal_id,
    'amount', target_amount,
    'account_id', target_account_id,
    'category_id', target_category_id,
    'date', target_date
  );
  insert into public.goal_operation_requests (
    user_id, request_id, operation, request_payload
  )
  values (actor_id, target_request_id, 'reduce', request_payload)
  on conflict (user_id, request_id) do nothing;
  get diagnostics rows_inserted = row_count;

  select * into existing_request
  from public.goal_operation_requests
  where user_id = actor_id
    and goal_operation_requests.request_id = target_request_id
  for update;
  if existing_request.operation <> 'reduce'
     or existing_request.request_payload <> request_payload then
    raise exception 'Request ID was already used for a different operation';
  end if;
  if rows_inserted = 0 and existing_request.transaction_id is null then
    raise exception 'Previously started request has no transaction result';
  end if;
  if existing_request.transaction_id is not null then
    return existing_request.transaction_id;
  end if;

  select * into goal_row
  from public.savings_goals
  where id = target_goal_id
  for update;
  if not found or not public.can_write_scope(
    goal_row.owner_user_id, goal_row.family_id
  ) then
    raise exception 'Goal is unavailable or cannot be changed';
  end if;

  select * into account_row
  from public.wallets
  where id = target_account_id and not is_archived;
  if not found or not public.can_write_scope(
    account_row.owner_user_id, account_row.family_id
  ) then
    raise exception 'Account is unavailable or cannot be changed';
  end if;
  if not (
    (goal_row.family_id is null
      and account_row.owner_user_id = goal_row.owner_user_id
      and account_row.family_id is null)
    or (goal_row.family_id is not null
      and (account_row.family_id = goal_row.family_id
        or (account_row.owner_user_id = actor_id
          and account_row.family_id is null)))
  ) then
    raise exception 'Account scope does not match goal scope';
  end if;

  select * into category_row
  from public.categories
  where id = target_category_id and not is_archived;
  if not found
     or category_row.owner_user_id is distinct from account_row.owner_user_id
     or category_row.family_id is distinct from account_row.family_id
     or category_row.category_type::text <> 'income' then
    raise exception 'Category scope or type does not match contribution';
  end if;

  select coalesce(sum(amount), 0) into saved_total
  from public.savings_goal_contributions
  where goal_id = target_goal_id;
  if target_amount > saved_total then
    raise exception 'Reduction exceeds current goal progress';
  end if;

  remaining := target_amount;
  for contribution_row in
    select *
    from public.savings_goal_contributions
    where goal_id = target_goal_id
    order by contribution_date desc, created_at desc, id desc
    for update
  loop
    exit when remaining = 0;
    if contribution_row.amount <= remaining then
      remaining := remaining - contribution_row.amount;
      delete from public.savings_goal_contributions
      where id = contribution_row.id;
    else
      update public.savings_goal_contributions
      set amount = contribution_row.amount - remaining
      where id = contribution_row.id;
      remaining := 0;
    end if;
  end loop;
  if remaining <> 0 then
    raise exception 'Goal contributions changed during reduction';
  end if;

  created_transaction_id := gen_random_uuid();
  insert into public.financial_transactions (
    id, owner_user_id, family_id, account_id, category_id,
    transaction_type, amount, transaction_date, description, created_by
  )
  values (
    created_transaction_id, account_row.owner_user_id, account_row.family_id,
    target_account_id, target_category_id, 'income', target_amount,
    target_date, 'Kurangi progres target: ' || goal_row.name, actor_id
  );

  update public.goal_operation_requests
  set transaction_id = created_transaction_id
  where user_id = actor_id
    and goal_operation_requests.request_id = target_request_id;

  return created_transaction_id;
end;
$$;

create or replace function public.prevent_goal_transaction_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.savings_goal_contributions contribution
    where contribution.transaction_id = old.id
  ) or exists (
    select 1
    from public.goal_operation_requests request
    join public.savings_goals goal
      on goal.id = (request.request_payload ->> 'goal_id')::uuid
    where request.transaction_id = old.id
  ) then
    raise exception 'Transactions generated by goal progress cannot be edited or deleted directly';
  end if;
  return old;
end;
$$;

create table public.goal_transaction_cleanup (
  transaction_id uuid primary key
    references public.financial_transactions(id) on delete cascade
);

alter table public.goal_transaction_cleanup enable row level security;

create or replace function public.prevent_goal_transaction_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.goal_transaction_cleanup cleanup
    where cleanup.transaction_id = old.id
  ) then
    if tg_op = 'DELETE' then
      return old;
    end if;

    if (to_jsonb(new) - 'deleted_at' - 'updated_at')
         = (to_jsonb(old) - 'deleted_at' - 'updated_at')
       and old.deleted_at is null
       and new.deleted_at is not null then
      return new;
    end if;
  end if;

  if exists (
    select 1
    from public.savings_goal_contributions contribution
    where contribution.transaction_id = old.id
  ) or exists (
    select 1
    from public.goal_operation_requests request
    where request.transaction_id = old.id
  ) then
    raise exception 'Transactions generated by goal progress cannot be edited or deleted directly';
  end if;

  if tg_op = 'UPDATE' then
    return new;
  end if;
  return old;
end;
$$;

drop trigger if exists transactions_protect_goal_operations
  on public.financial_transactions;

create trigger transactions_protect_goal_operations
before update or delete on public.financial_transactions
for each row execute function public.prevent_goal_transaction_mutation();

create or replace function public.delete_savings_goal(target_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  goal_row public.savings_goals%rowtype;
  goal_transaction_ids uuid[];
begin
  if actor_id is null then
    raise exception 'Authentication is required';
  end if;

  select * into goal_row
  from public.savings_goals
  where id = target_goal_id
  for update;

  if not found then
    return;
  end if;
  if not public.can_write_scope(goal_row.owner_user_id, goal_row.family_id) then
    raise exception 'Goal is unavailable or cannot be changed';
  end if;

  select array_agg(distinct tx.id)
  into goal_transaction_ids
  from public.financial_transactions tx
  where exists (
    select 1
    from public.savings_goal_contributions contribution
    where contribution.goal_id = target_goal_id
      and contribution.transaction_id = tx.id
  ) or exists (
    select 1
    from public.goal_operation_requests request
    where request.transaction_id = tx.id
      and request.request_payload ->> 'goal_id' = target_goal_id::text
  );

  if goal_transaction_ids is not null then
    insert into public.goal_transaction_cleanup (transaction_id)
    select unnest(goal_transaction_ids)
    on conflict (transaction_id) do nothing;

    insert into public.transaction_delete_tombstones (transaction_id)
    select unnest(goal_transaction_ids)
    on conflict (transaction_id) do nothing;

    delete from public.financial_transactions
    where id = any(goal_transaction_ids);
  end if;

  delete from public.goal_operation_requests
  where request_payload ->> 'goal_id' = target_goal_id::text;

  delete from public.savings_goals
  where id = target_goal_id;
end;
$$;
