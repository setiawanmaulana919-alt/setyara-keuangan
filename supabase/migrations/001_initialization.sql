-- Database extensions and shared types.

create extension if not exists pgcrypto;

create type public.transaction_type as enum ('income', 'expense');

create type public.category_type as enum ('income', 'expense');

create type public.account_type as enum ('cash', 'bank', 'e_wallet', 'savings', 'other', 'investment', 'receivable');

create type public.family_role as enum ('owner', 'editor', 'viewer');

create type public.membership_status as enum ('active', 'invited', 'removed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create extension if not exists pg_trgm with schema extensions;
