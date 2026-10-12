import type { SavingsGoal } from "@/types/data-model";

export interface GoalProgress {
  goal: SavingsGoal;
  saved: number;
  remaining: number;
  percentage: number;
}
