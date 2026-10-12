-- Asset valuation schema and policies.

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  asset_type text not null,
  quantity numeric(20,6),
  acquisition_value bigint not null default 0 check (acquisition_value >= 0),
  acquisition_date date,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((owner_user_id is not null)::int + (family_id is not null)::int = 1)
);

create table public.asset_valuation_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  valuation_date date not null,
  market_value bigint not null check (market_value >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (asset_id, valuation_date)
);

create trigger assets_set_updated_at before update on public.assets
for each row execute function public.set_updated_at();

alter table public.assets enable row level security;

alter table public.asset_valuation_history enable row level security;

create policy assets_select_scope on public.assets
for select to authenticated using (public.can_access_scope(owner_user_id, family_id));

create policy assets_insert_scope on public.assets
for insert to authenticated with check (public.can_write_scope(owner_user_id, family_id));

create policy assets_update_scope on public.assets
for update to authenticated using (public.can_write_scope(owner_user_id, family_id))
with check (public.can_write_scope(owner_user_id, family_id));

create policy assets_delete_scope on public.assets
for delete to authenticated using (public.can_write_scope(owner_user_id, family_id));

create policy asset_valuations_select_scope on public.asset_valuation_history
for select to authenticated using (
  exists (
    select 1 from public.assets asset
    where asset.id = asset_id
      and public.can_access_scope(asset.owner_user_id, asset.family_id)
  )
);

create policy asset_valuations_insert_scope on public.asset_valuation_history
for insert to authenticated with check (
  exists (
    select 1 from public.assets asset
    where asset.id = asset_id
      and public.can_write_scope(asset.owner_user_id, asset.family_id)
  )
);

create policy asset_valuations_update_scope on public.asset_valuation_history
for update to authenticated using (
  exists (
    select 1 from public.assets asset
    where asset.id = asset_id
      and public.can_write_scope(asset.owner_user_id, asset.family_id)
  )
);

create policy asset_valuations_delete_scope on public.asset_valuation_history
for delete to authenticated using (
  exists (
    select 1 from public.assets asset
    where asset.id = asset_id
      and public.can_write_scope(asset.owner_user_id, asset.family_id)
  )
);

create or replace function public.list_asset_summaries()
returns table (
  id uuid,
  owner_user_id uuid,
  name text,
  asset_type text,
  acquisition_value bigint,
  created_at timestamptz,
  updated_at timestamptz,
  market_value bigint,
  valuation_date date
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    asset.id,
    asset.owner_user_id,
    asset.name,
    asset.asset_type,
    asset.acquisition_value,
    asset.created_at,
    asset.updated_at,
    valuation.market_value,
    valuation.valuation_date
  from public.assets asset
  left join lateral (
    select history.market_value, history.valuation_date
    from public.asset_valuation_history history
    where history.asset_id = asset.id
    order by history.valuation_date desc
    limit 1
  ) valuation on true
  where asset.is_archived = false
  order by asset.created_at, asset.id;
$$;
