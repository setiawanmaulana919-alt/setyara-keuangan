-- Rename the built-in "Tambahan" category without losing linked records.
create temporary table category_rename_merge on commit drop as
select
  old_category.id as old_id,
  new_category.id as new_id
from public.categories as old_category
join public.categories as new_category
  on new_category.owner_user_id is not distinct from old_category.owner_user_id
  and new_category.family_id is not distinct from old_category.family_id
  and new_category.category_type = old_category.category_type
  and lower(btrim(new_category.name)) = 'keinginan'
where lower(btrim(old_category.name)) = 'tambahan'
  and old_category.category_type = 'expense';

update public.financial_transactions as transactions
set category_id = merged.new_id
from category_rename_merge as merged
where transactions.category_id = merged.old_id;

update public.spending_budgets as budgets
set category_id = merged.new_id
from category_rename_merge as merged
where budgets.category_id = merged.old_id;

update public.categories as new_category
set is_archived = new_category.is_archived and old_category.is_archived
from category_rename_merge as merged
join public.categories as old_category on old_category.id = merged.old_id
where new_category.id = merged.new_id;

delete from public.categories as categories
using category_rename_merge as merged
where categories.id = merged.old_id;

update public.categories
set name = 'Keinginan'
where category_type = 'expense'
  and lower(btrim(name)) = 'tambahan';

update public.categories
set name = case
  when lower(btrim(name)) = 'pokok' then 'Pokok'
  when lower(btrim(name)) = 'sampingan' then 'Sampingan'
  when lower(btrim(name)) = 'kebutuhan' then 'Kebutuhan'
  when lower(btrim(name)) = 'keinginan' then 'Keinginan'
  when lower(btrim(name)) = 'darurat' then 'Darurat'
  when lower(btrim(name)) = 'lainnya' then 'Lainnya'
  else name
end,
is_archived = false
where (category_type = 'income'
    and lower(btrim(name)) in ('pokok', 'sampingan'))
  or (category_type = 'expense'
    and lower(btrim(name)) in (
      'kebutuhan',
      'keinginan',
      'darurat',
      'lainnya'
    ));

insert into public.categories (
  owner_user_id,
  family_id,
  name,
  category_type
)
select
  null,
  families.id,
  defaults.name,
  defaults.category_type::public.category_type
from public.families as families
cross join (
  values
    ('Pokok', 'income'),
    ('Sampingan', 'income'),
    ('Kebutuhan', 'expense'),
    ('Keinginan', 'expense'),
    ('Darurat', 'expense'),
    ('Lainnya', 'expense')
) as defaults(name, category_type)
where not exists (
  select 1
  from public.categories as categories
  where categories.family_id = families.id
    and categories.category_type = defaults.category_type::public.category_type
    and lower(btrim(categories.name)) = lower(defaults.name)
);

create or replace function public.seed_family_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (
    owner_user_id,
    family_id,
    name,
    category_type
  )
  values
    (null, new.id, 'Pokok', 'income'),
    (null, new.id, 'Sampingan', 'income'),
    (null, new.id, 'Kebutuhan', 'expense'),
    (null, new.id, 'Keinginan', 'expense'),
    (null, new.id, 'Darurat', 'expense'),
    (null, new.id, 'Lainnya', 'expense')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists families_seed_default_categories on public.families;
create trigger families_seed_default_categories
after insert on public.families
for each row execute function public.seed_family_default_categories();
