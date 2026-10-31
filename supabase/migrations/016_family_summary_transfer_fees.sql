begin;

-- Keep family totals aligned with wallet balances when transfers include fees.
do $$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.get_family_member_finance_summary(uuid)'::regprocedure
  );
  definition := replace(
    definition,
    'else -transfer.amount',
    'else -(transfer.amount + transfer.transfer_fee)'
  );
  execute definition;
end;
$$;

commit;
