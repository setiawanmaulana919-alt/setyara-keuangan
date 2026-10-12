-- Loan schema, repayment workflows, and policies.

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('receivable', 'payable')),
  counterparty_name text not null
    check (length(trim(counterparty_name)) between 1 and 100),
  principal_amount bigint not null check (principal_amount > 0),
  account_id uuid not null references public.wallets(id) on delete restrict,
  issue_date date not null default current_date,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or due_date >= issue_date)
);

create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  account_id uuid not null references public.wallets(id) on delete restrict,
  amount bigint not null check (amount > 0),
  repayment_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index loans_owner_date_idx
  on public.loans (owner_user_id, issue_date desc, id desc);

create index loan_payments_loan_idx
  on public.loan_payments (loan_id)
  include (amount);

create index loan_payments_wallet_idx
  on public.loan_payments (account_id);

alter table public.loans enable row level security;

alter table public.loan_payments enable row level security;

create policy loan_records_select_own
  on public.loans
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy loan_repayments_select_own
  on public.loan_payments
  for select to authenticated
  using (
    exists (
      select 1
      from public.loans loan
      where loan.id = loan_id
        and loan.owner_user_id = auth.uid()
    )
  );

create or replace function public.create_loan_record(
  target_direction text,
  target_counterparty_name text,
  target_principal_amount bigint,
  target_account_id uuid,
  target_issue_date date,
  target_due_date date default null,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_loan_id uuid;
  account_owner_id uuid;
  account_family_id uuid;
  account_archived boolean;
  account_kind text;
begin
  if current_user_id is null then
    raise exception 'Login diperlukan.';
  end if;
  if target_direction not in ('receivable', 'payable') then
    raise exception 'Jenis piutang atau utang tidak valid.';
  end if;
  if target_principal_amount <= 0 then
    raise exception 'Jumlah harus lebih besar dari nol.';
  end if;
  if length(trim(target_counterparty_name)) not between 1 and 100 then
    raise exception 'Nama pihak terkait harus memiliki 1-100 karakter.';
  end if;
  if target_due_date is not null and target_due_date < target_issue_date then
    raise exception 'Tanggal jatuh tempo tidak boleh sebelum tanggal pinjaman.';
  end if;

  select owner_user_id, family_id, is_archived, account_type::text
  into account_owner_id, account_family_id, account_archived, account_kind
  from public.wallets
  where id = target_account_id;

  if account_owner_id is distinct from current_user_id
    or account_family_id is not null
    or account_archived is distinct from false
    or account_kind in ('investment', 'receivable')
  then
    raise exception 'Pilih dompet pribadi aktif sebagai sumber dana.';
  end if;

  insert into public.loans (
    owner_user_id, direction, counterparty_name, principal_amount,
    account_id, issue_date, due_date, notes
  ) values (
    current_user_id, target_direction, trim(target_counterparty_name),
    target_principal_amount, target_account_id, target_issue_date,
    target_due_date, nullif(trim(target_notes), '')
  )
  returning id into created_loan_id;

  return created_loan_id;
end;
$$;

create or replace function public.record_loan_repayment(
  target_loan_id uuid,
  target_account_id uuid,
  target_amount bigint,
  target_repayment_date date,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_loan public.loans%rowtype;
  amount_repaid bigint;
  account_owner_id uuid;
  account_family_id uuid;
  account_archived boolean;
  account_kind text;
  created_repayment_id uuid;
begin
  if current_user_id is null then
    raise exception 'Login diperlukan.';
  end if;
  if target_amount <= 0 then
    raise exception 'Jumlah pembayaran harus lebih besar dari nol.';
  end if;

  select *
  into target_loan
  from public.loans
  where id = target_loan_id
    and owner_user_id = current_user_id
  for update;

  if not found then
    raise exception 'Catatan piutang atau utang tidak ditemukan.';
  end if;
  if target_repayment_date < target_loan.issue_date then
    raise exception 'Tanggal pembayaran tidak boleh sebelum tanggal pinjaman.';
  end if;

  select coalesce(sum(amount), 0)::bigint
  into amount_repaid
  from public.loan_payments
  where loan_id = target_loan_id;

  if target_amount > target_loan.principal_amount - amount_repaid then
    raise exception 'Jumlah pembayaran melebihi sisa piutang atau utang.';
  end if;

  select owner_user_id, family_id, is_archived, account_type::text
  into account_owner_id, account_family_id, account_archived, account_kind
  from public.wallets
  where id = target_account_id;

  if account_owner_id is distinct from current_user_id
    or account_family_id is not null
    or account_archived is distinct from false
    or account_kind in ('investment', 'receivable')
  then
    raise exception 'Pilih dompet pribadi aktif untuk pembayaran.';
  end if;

  insert into public.loan_payments (
    loan_id, account_id, amount, repayment_date, notes
  ) values (
    target_loan_id, target_account_id, target_amount,
    target_repayment_date, nullif(trim(target_notes), '')
  )
  returning id into created_repayment_id;

  return created_repayment_id;
end;
$$;

create or replace function public.list_loan_records()
returns table (
  id uuid,
  direction text,
  counterparty_name text,
  principal_amount bigint,
  remaining_amount bigint,
  account_id uuid,
  account_name text,
  issue_date date,
  due_date date,
  notes text,
  repayment_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    loan.id,
    loan.direction,
    loan.counterparty_name,
    loan.principal_amount,
    (loan.principal_amount - coalesce(sum(repayment.amount), 0))::bigint,
    loan.account_id,
    account.name,
    loan.issue_date,
    loan.due_date,
    loan.notes,
    count(repayment.id)::bigint
  from public.loans loan
  join public.wallets account on account.id = loan.account_id
  left join public.loan_payments repayment on repayment.loan_id = loan.id
  where loan.owner_user_id = auth.uid()
  group by loan.id, account.name
  order by loan.issue_date desc, loan.id desc;
$$;

create or replace function public.update_loan_record(
  target_loan_id uuid,
  target_direction text,
  target_counterparty_name text,
  target_principal_amount bigint,
  target_account_id uuid,
  target_issue_date date,
  target_due_date date default null,
  target_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_loan public.loans%rowtype;
  paid_amount bigint;
  first_repayment_date date;
  account_owner_id uuid;
  account_family_id uuid;
  account_archived boolean;
  account_kind text;
begin
  if current_user_id is null then
    raise exception 'Login diperlukan.';
  end if;
  if target_direction is null
    or target_direction not in ('receivable', 'payable')
  then
    raise exception 'Jenis piutang atau utang tidak valid.';
  end if;
  if target_principal_amount is null or target_principal_amount <= 0 then
    raise exception 'Jumlah harus lebih besar dari nol.';
  end if;
  if target_counterparty_name is null
    or length(trim(target_counterparty_name)) not between 1 and 100
  then
    raise exception 'Nama pihak terkait harus memiliki 1-100 karakter.';
  end if;
  if target_issue_date is null or target_account_id is null then
    raise exception 'Tanggal dan dompet pinjaman wajib diisi.';
  end if;
  if target_due_date is not null and target_due_date < target_issue_date then
    raise exception 'Tanggal jatuh tempo tidak boleh sebelum tanggal pinjaman.';
  end if;

  select *
  into target_loan
  from public.loans
  where id = target_loan_id
    and owner_user_id = current_user_id
  for update;

  if not found then
    raise exception 'Catatan piutang atau utang tidak ditemukan.';
  end if;

  select coalesce(sum(amount), 0)::bigint, min(repayment_date)
  into paid_amount, first_repayment_date
  from public.loan_payments
  where loan_id = target_loan_id;

  if target_principal_amount < paid_amount then
    raise exception 'Jumlah pokok tidak boleh lebih kecil dari total pembayaran.';
  end if;
  if first_repayment_date is not null
    and target_issue_date > first_repayment_date
  then
    raise exception 'Tanggal pinjaman tidak boleh sesudah pembayaran yang sudah dicatat.';
  end if;

  select owner_user_id, family_id, is_archived, account_type::text
  into account_owner_id, account_family_id, account_archived, account_kind
  from public.wallets
  where id = target_account_id;

  if account_owner_id is distinct from current_user_id
    or account_family_id is not null
    or account_archived is distinct from false
    or account_kind in ('investment', 'receivable')
  then
    raise exception 'Pilih dompet pribadi aktif sebagai sumber dana.';
  end if;

  update public.loans
  set direction = target_direction,
      counterparty_name = trim(target_counterparty_name),
      principal_amount = target_principal_amount,
      account_id = target_account_id,
      issue_date = target_issue_date,
      due_date = target_due_date,
      notes = nullif(trim(target_notes), ''),
      updated_at = now()
  where id = target_loan_id
    and owner_user_id = current_user_id;
end;
$$;

create or replace function public.delete_loan_record(target_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Login diperlukan.';
  end if;

  delete from public.loans
  where id = target_loan_id
    and owner_user_id = current_user_id;

  if not found then
    raise exception 'Catatan piutang atau utang tidak ditemukan.';
  end if;
end;
$$;

create table public.loan_operation_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  operation text not null check (operation in ('create', 'repayment')),
  request_payload jsonb not null,
  result_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create or replace function public.create_loan_record_idempotent(
  target_request_id uuid,
  target_direction text,
  target_counterparty_name text,
  target_principal_amount bigint,
  target_account_id uuid,
  target_issue_date date,
  target_due_date date default null,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  request_payload jsonb;
  existing_request public.loan_operation_requests%rowtype;
  created_loan_id uuid;
  rows_inserted integer;
begin
  if actor_id is null then
    raise exception 'Login diperlukan.';
  end if;
  if target_request_id is null then
    raise exception 'Request ID pinjaman wajib diisi.';
  end if;

  request_payload := jsonb_build_object(
    'direction', target_direction,
    'counterparty_name', trim(target_counterparty_name),
    'principal_amount', target_principal_amount,
    'account_id', target_account_id,
    'issue_date', target_issue_date,
    'due_date', target_due_date,
    'notes', nullif(trim(target_notes), '')
  );
  insert into public.loan_operation_requests (
    user_id, request_id, operation, request_payload
  )
  values (actor_id, target_request_id, 'create', request_payload)
  on conflict (user_id, request_id) do nothing;
  get diagnostics rows_inserted = row_count;

  select * into existing_request
  from public.loan_operation_requests
  where user_id = actor_id
    and loan_operation_requests.request_id = target_request_id
  for update;
  if existing_request.operation <> 'create'
     or existing_request.request_payload <> request_payload then
    raise exception 'Request ID pinjaman sudah digunakan untuk data lain.';
  end if;
  if rows_inserted = 0 and existing_request.result_id is null then
    raise exception 'Request pinjaman sebelumnya tidak memiliki hasil.';
  end if;
  if existing_request.result_id is not null then
    return existing_request.result_id;
  end if;

  created_loan_id := public.create_loan_record(
    target_direction,
    target_counterparty_name,
    target_principal_amount,
    target_account_id,
    target_issue_date,
    target_due_date,
    target_notes
  );
  update public.loan_operation_requests
  set result_id = created_loan_id
  where user_id = actor_id
    and loan_operation_requests.request_id = target_request_id;
  return created_loan_id;
end;
$$;

create or replace function public.record_loan_repayment_idempotent(
  target_request_id uuid,
  target_loan_id uuid,
  target_account_id uuid,
  target_amount bigint,
  target_repayment_date date,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  request_payload jsonb;
  existing_request public.loan_operation_requests%rowtype;
  created_repayment_id uuid;
  rows_inserted integer;
begin
  if actor_id is null then
    raise exception 'Login diperlukan.';
  end if;
  if target_request_id is null then
    raise exception 'Request ID pembayaran wajib diisi.';
  end if;

  request_payload := jsonb_build_object(
    'loan_id', target_loan_id,
    'account_id', target_account_id,
    'amount', target_amount,
    'repayment_date', target_repayment_date,
    'notes', nullif(trim(target_notes), '')
  );
  insert into public.loan_operation_requests (
    user_id, request_id, operation, request_payload
  )
  values (actor_id, target_request_id, 'repayment', request_payload)
  on conflict (user_id, request_id) do nothing;
  get diagnostics rows_inserted = row_count;

  select * into existing_request
  from public.loan_operation_requests
  where user_id = actor_id
    and loan_operation_requests.request_id = target_request_id
  for update;
  if existing_request.operation <> 'repayment'
     or existing_request.request_payload <> request_payload then
    raise exception 'Request ID pembayaran sudah digunakan untuk data lain.';
  end if;
  if rows_inserted = 0 and existing_request.result_id is null then
    raise exception 'Request pembayaran sebelumnya tidak memiliki hasil.';
  end if;
  if existing_request.result_id is not null then
    return existing_request.result_id;
  end if;

  created_repayment_id := public.record_loan_repayment(
    target_loan_id,
    target_account_id,
    target_amount,
    target_repayment_date,
    target_notes
  );
  update public.loan_operation_requests
  set result_id = created_repayment_id
  where user_id = actor_id
    and loan_operation_requests.request_id = target_request_id;
  return created_repayment_id;
end;
$$;

create or replace function public.list_loan_records()
returns table (
  id uuid,
  direction text,
  counterparty_name text,
  principal_amount bigint,
  remaining_amount bigint,
  account_id uuid,
  account_name text,
  issue_date date,
  due_date date,
  notes text,
  repayment_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    loan.id,
    loan.direction,
    loan.counterparty_name,
    loan.principal_amount,
    (loan.principal_amount - coalesce(payments.amount, 0))::bigint,
    loan.account_id,
    wallet.name,
    loan.issue_date,
    loan.due_date,
    loan.notes,
    coalesce(payments.payment_count, 0)::bigint
  from public.loans loan
  join public.wallets wallet on wallet.id = loan.account_id
  left join lateral (
    select sum(payment.amount) as amount, count(*) as payment_count
    from public.loan_payments payment
    where payment.loan_id = loan.id
  ) payments on true
  where loan.owner_user_id = auth.uid()
  order by loan.issue_date desc, loan.id desc;
$$;
