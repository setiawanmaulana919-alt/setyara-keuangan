create or replace function public.set_loan_recorded_at(
  target_loan_id uuid,
  target_recorded_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Login diperlukan.';
  end if;

  update public.loans
  set created_at = target_recorded_at
  where id = target_loan_id
    and owner_user_id = auth.uid();

  if not found then
    raise exception 'Catatan piutang atau utang tidak ditemukan.';
  end if;
end;
$$;

create or replace function public.set_loan_payment_recorded_at(
  target_payment_id uuid,
  target_recorded_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Login diperlukan.';
  end if;

  update public.loan_payments payment
  set created_at = target_recorded_at
  where payment.id = target_payment_id
    and exists (
      select 1
      from public.loans loan
      where loan.id = payment.loan_id
        and loan.owner_user_id = auth.uid()
    );

  if not found then
    raise exception 'Pembayaran pinjaman tidak ditemukan.';
  end if;
end;
$$;

revoke all on function public.set_loan_recorded_at(uuid, timestamptz) from public;
grant execute on function public.set_loan_recorded_at(uuid, timestamptz) to authenticated;

revoke all on function public.set_loan_payment_recorded_at(uuid, timestamptz) from public;
grant execute on function public.set_loan_payment_recorded_at(uuid, timestamptz) to authenticated;
