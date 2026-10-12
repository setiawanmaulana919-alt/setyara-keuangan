-- Profiles, family membership, invitations, and access rules.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_memberships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.family_role not null default 'viewer',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create index idx_family_memberships_user on public.family_memberships(user_id, status);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger families_set_updated_at before update on public.families
for each row execute function public.set_updated_at();

create or replace function public.is_active_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_memberships member
    where member.family_id = target_family_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  );
$$;

create or replace function public.family_role(target_family_id uuid)
returns public.family_role
language sql
stable
security definer
set search_path = public
as $$
  select member.role
  from public.family_memberships member
  where member.family_id = target_family_id
    and member.user_id = auth.uid()
    and member.status = 'active'
  limit 1;
$$;

create or replace function public.can_access_scope(
  target_owner_user_id uuid,
  target_family_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    target_owner_user_id = auth.uid()
    and target_family_id is null
  ) or (
    target_owner_user_id is null
    and public.is_active_family_member(target_family_id)
  );
$$;

create or replace function public.can_write_scope(
  target_owner_user_id uuid,
  target_family_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    target_owner_user_id = auth.uid()
    and target_family_id is null
  ) or (
    target_owner_user_id is null
    and public.family_role(target_family_id) in ('owner', 'editor')
  );
$$;

create or replace function public.add_family_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_memberships (family_id, user_id, role, status)
  values (new.id, new.owner_user_id, 'owner', 'active')
  on conflict (family_id, user_id) do update
    set role = 'owner', status = 'active';
  return new;
end;
$$;

drop trigger if exists families_add_owner_membership on public.families;

create trigger families_add_owner_membership
after insert on public.families
for each row execute function public.add_family_owner_membership();

create or replace function public.protect_family_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner' and (new.role <> 'owner' or new.status <> 'active') then
    if not exists (
      select 1
      from public.family_memberships member
      where member.family_id = old.family_id
        and member.id <> old.id
        and member.role = 'owner'
        and member.status = 'active'
    ) then
      raise exception 'A family must retain at least one active owner';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists family_members_protect_owner on public.family_memberships;

create trigger family_members_protect_owner
before update or delete on public.family_memberships
for each row execute function public.protect_family_owner_membership();

alter table public.profiles enable row level security;

alter table public.families enable row level security;

alter table public.family_memberships enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated using (id = auth.uid());

create policy profiles_insert_own on public.profiles
for insert to authenticated with check (id = auth.uid());

create policy profiles_update_own on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy families_select_member on public.families
for select to authenticated using (
  owner_user_id = auth.uid() or public.is_active_family_member(id)
);

create policy families_insert_owner on public.families
for insert to authenticated with check (owner_user_id = auth.uid());

create policy families_update_owner on public.families
for update to authenticated using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy families_delete_owner on public.families
for delete to authenticated using (owner_user_id = auth.uid());

create policy family_members_select_member on public.family_memberships
for select to authenticated using (user_id = auth.uid() or public.is_active_family_member(family_id));

create policy family_members_insert_owner on public.family_memberships
for insert to authenticated with check (
  public.family_role(family_id) = 'owner'
);

create policy family_members_update_owner on public.family_memberships
for update to authenticated using (public.family_role(family_id) = 'owner')
with check (public.family_role(family_id) = 'owner');

create policy family_members_delete_owner on public.family_memberships
for delete to authenticated using (public.family_role(family_id) = 'owner');

create table public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  code_hash text not null unique,
  role public.family_role not null default 'viewer',
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 100),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index family_invitations_family_idx
  on public.family_invitations(family_id);

alter table public.family_invitations enable row level security;

create policy family_invitations_select_owner
on public.family_invitations
for select to authenticated
using (
  exists (
    select 1 from public.families family
    where family.id = family_invitations.family_id
      and family.owner_user_id = auth.uid()
  )
);

alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (
    username is null
    or username ~ '^[a-zA-Z0-9_]{3,30}$'
  );

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    nullif(lower(trim(new.raw_user_meta_data ->> 'username')), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), '')
  )
  on conflict (id) do update
    set username = coalesce(excluded.username, profiles.username),
        display_name = coalesce(excluded.display_name, profiles.display_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

create or replace function public.lookup_login_email(login_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_email text;
  match_count integer;
begin
  select count(*), min(u.email)
    into match_count, matched_email
    from public.profiles profile
    join auth.users u on u.id = profile.id
   where (
     lower(profile.username) = lower(trim(login_username))
     or lower(profile.display_name) = lower(trim(login_username))
   )
   and u.email is not null;

  if match_count = 1 then
    return matched_email;
  end if;
  return null;
end;
$$;

drop policy if exists profiles_select_own on public.profiles;

create policy profiles_select_own on public.profiles
for select to authenticated
using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;

create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

alter table public.family_invitations
add column if not exists code_text text;

drop policy if exists profiles_select_family_members on public.profiles;

create policy profiles_select_family_members
on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.family_memberships member
    where member.user_id = profiles.id
      and member.status = 'active'
      and public.is_active_family_member(member.family_id)
  )
);

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_insert_own on storage.objects;

create policy profile_avatars_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists profile_avatars_update_own on storage.objects;

create policy profile_avatars_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists profile_avatars_delete_own on storage.objects;

create policy profile_avatars_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists profile_avatars_select_own on storage.objects;

create policy profile_avatars_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.protect_family_owner_membership()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if old.role = 'owner'
     and (new.role <> 'owner' or new.status <> 'active')
     and not exists (
       select 1
       from public.family_memberships member
       where member.family_id = old.family_id
         and member.id <> old.id
         and member.role = 'owner'
         and member.status = 'active'
     ) then
    raise exception 'A family must retain at least one active owner';
  end if;

  return new;
end;
$$;
