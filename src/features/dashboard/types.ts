import type {
  Account,
  Category,
  FinancialTransaction,
  Transfer,
} from "@/types/data-model";
import type { GoalProgress } from "@/features/goals/types";
import type { LoanActivity } from "@/features/loans/types";
import type { AccountBalance } from "@/features/wallets/types";

export interface DashboardSummary {
  balance: number;
  income: number;
  expense: number;
  cashFlow: number;
  expenseByCategory: Array<{
    categoryId: string;
    name: string;
    amount: number;
  }>;
}

export interface DashboardData {
  summary: DashboardSummary;
  balances: AccountBalance[];
  goals: GoalProgress[];
  transactions: FinancialTransaction[];
  transfers: Transfer[];
  loanActivities: LoanActivity[];
  accounts: Account[];
  categories: Category[];
}
