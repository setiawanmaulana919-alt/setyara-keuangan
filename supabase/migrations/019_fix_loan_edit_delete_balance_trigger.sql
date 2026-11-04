do $$
declare
  definition text;
begin
  definition := pg_get_functiondef(
    'public.prevent_negative_wallet_balance()'::regprocedure
  );
  definition := replace(
    definition,
    $old$when old.direction = 'receivable' then -repayment.amount
          else repayment.amount$old$,
    $new$when old.direction = 'receivable' then repayment.amount
          else -repayment.amount$new$
  );
  execute definition;
end;
$$;
