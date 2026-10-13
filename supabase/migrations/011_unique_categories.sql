-- Consolidate duplicate categories, then prevent future duplicates within a scope and type.

create temporary table category_deduplication on commit drop as
select duplicate_id, canonical_id
from (
  select
    id as duplicate_id,
    first_value(id) over (
      partition by owner_user_id, family_id, category_type, lower(btrim(name))
      order by is_archived, created_at, id
    ) as canonical_id,
    row_number() over (
      partition by owner_user_id, family_id, category_type, lower(btrim(name))
      order by is_archived, created_at, id
    ) as duplicate_rank
  from public.categories
) ranked_categories
where duplicate_rank > 1;

update public.financial_transactions as transactions
set category_id = duplicates.canonical_id
from category_deduplication as duplicates
where transactions.category_id = duplicates.duplicate_id;

update public.spending_budgets as budgets
set category_id = duplicates.canonical_id
from category_deduplication as duplicates
where budgets.category_id = duplicates.duplicate_id;

delete from public.categories as categories
using category_deduplication as duplicates
where categories.id = duplicates.duplicate_id;

create unique index categories_personal_name_type_unique
  on public.categories (owner_user_id, category_type, lower(btrim(name)))
  where owner_user_id is not null;

create unique index categories_family_name_type_unique
  on public.categories (family_id, category_type, lower(btrim(name)))
  where family_id is not null;
