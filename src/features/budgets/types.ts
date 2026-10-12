import type { Budget } from "@/types/data-model";

export interface BudgetProgress {
  budget: Budget;
  categoryName: string;
  actual: number;
  remaining: number;
  exceeded: boolean;
}
