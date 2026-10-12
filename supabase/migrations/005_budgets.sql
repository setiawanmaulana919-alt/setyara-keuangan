-- Budget schema, validation, and policies.

create table public.spending_budgets (
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

create index idx_spending_budgets_owner_period on public.spending_budgets(owner_user_id, period_start, period_end);

create index idx_spending_budgets_family_period on public.spending_budgets(family_id, period_start, period_end);

create trigger budgets_set_updated_at before update on public.spending_budgets
for each row execute function public.set_updated_at();

create or replace function public.validate_category_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  category_owner uuid;
  category_family uuid;
begin
  select owner_user_id, family_id into category_owner, category_family
  from public.categories where id = new.category_id;

  if category_owner is null and category_family is null then
    raise exception 'Referenced category does not exist';
  end if;

  if new.owner_user_id is distinct from category_owner
     or new.family_id is distinct from category_family then
    raise exception 'Category scope does not match record scope';
  end if;

  return new;
end;
$$;

drop trigger if exists budgets_validate_category_scope on public.spending_budgets;

create trigger budgets_validate_category_scope
before insert or update on public.spending_budgets
for each row execute function public.validate_category_scope();

alter table public.spending_budgets enable row level security;

create policy budgets_select_scope on public.spending_budgets
for select to authenticated using (public.can_access_scope(owner_user_id, family_id));

create policy budgets_insert_scope on public.spending_budgets
for insert to authenticated with check (public.can_write_scope(owner_user_id, family_id));

create policy budgets_update_scope on public.spending_budgets
for update to authenticated using (public.can_write_scope(owner_user_id, family_id))
with check (public.can_write_scope(owner_user_id, family_id));

create policy budgets_delete_scope on public.spending_budgets
for delete to authenticated using (public.can_write_scope(owner_user_id, family_id));
