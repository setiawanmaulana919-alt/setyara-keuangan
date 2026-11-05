drop trigger if exists validate_goal_contribution_account_scope
on public.financial_transactions;

drop function if exists public.validate_goal_contribution_account_scope();
