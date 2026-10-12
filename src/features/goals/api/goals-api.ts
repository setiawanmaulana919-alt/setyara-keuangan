import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  GoalContribution,
  SavingsGoal,
  TransactionType,
} from "@/types/data-model";
import {
  id,
  GOAL_COLUMNS,
  GOAL_CONTRIBUTION_COLUMNS,
  getGoalContributionTotals,
  fetchAllRows,
  assertPositiveInteger,
  assertDate,
  currentUserId,
} from "@/features/finance/api/shared";
import type { GoalProgress } from "@/features/goals/types";

export async function createSavingsGoal(input: {
  name: string;
  targetAmount: number;
  targetDate?: string;
  scopeType?: "personal" | "family";
  familyId?: string;
}): Promise<SavingsGoal> {
  if (!input.name.trim()) throw new Error("Nama target wajib diisi.");
  assertPositiveInteger(input.targetAmount, "targetAmount");
  if (input.targetDate) assertDate(input.targetDate, "targetDate");
  const userId = await currentUserId();
  if (input.scopeType === "family" && !input.familyId) {
    throw new Error("Pilih keluarga untuk target keluarga.");
  }
  const { data, error } = await getSupabaseBrowserClient()
    .from("savings_goals")
    .insert({
      id: id(),
      owner_user_id: input.scopeType === "family" ? null : userId,
      family_id: input.scopeType === "family" ? input.familyId : null,
      name: input.name.trim(),
      target_amount: input.targetAmount,
      target_date: input.targetDate ?? null,
    })
    .select(GOAL_COLUMNS)
    .single();
  if (error) throw error;
  return {
    id: String(data.id),
    ownerUserId: input.scopeType === "family" ? undefined : userId,
    familyId: input.scopeType === "family" ? input.familyId : undefined,
    scopeType: input.scopeType === "family" ? "family" : "personal",
    name: String(data.name),
    targetAmount: Number(data.target_amount),
    targetDate: data.target_date ? String(data.target_date) : undefined,
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  };
}

export async function updateSavingsGoal(
  goalId: string,
  input: {
    name: string;
    targetAmount: number;
    targetDate?: string;
  },
): Promise<void> {
  if (!input.name.trim()) throw new Error("Nama target wajib diisi.");
  assertPositiveInteger(input.targetAmount, "targetAmount");
  if (input.targetDate) assertDate(input.targetDate, "targetDate");
  const { error } = await getSupabaseBrowserClient()
    .from("savings_goals")
    .update({
      name: input.name.trim(),
      target_amount: input.targetAmount,
      target_date: input.targetDate ?? null,
    })
    .eq("id", goalId);
  if (error) throw error;
}

export async function deleteSavingsGoal(goalId: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient().rpc(
    "delete_savings_goal",
    {
      target_goal_id: goalId,
    },
  );
  if (error) throw error;
}

export async function addGoalContribution(input: {
  goalId: string;
  amount: number;
  contributionDate: string;
  accountId: string;
  requestId: string;
}): Promise<GoalContribution> {
  const client = getSupabaseBrowserClient();
  const { data: goal, error: goalError } = await client
    .from("savings_goals")
    .select("id, owner_user_id, family_id, name")
    .eq("id", input.goalId)
    .maybeSingle();
  if (goalError) throw goalError;
  if (!goal) throw new Error("Target tabungan tidak ditemukan.");
  assertPositiveInteger(input.amount, "amount");
  assertDate(input.contributionDate, "contributionDate");
  const account = await assertAccountInGoalScope(input.accountId, goal, client);
  const transactionScope = {
    owner_user_id: account.owner_user_id,
    family_id: account.family_id,
    name: goal.name,
  };
  const categoryId = await getOrCreateGoalCategory(
    transactionScope,
    "expense",
    client,
  );
  const { data: transactionId, error: transactionError } = await client.rpc(
    "add_goal_contribution",
    {
      target_goal_id: input.goalId,
      target_request_id: input.requestId,
      target_amount: input.amount,
      target_account_id: input.accountId,
      target_category_id: categoryId,
      target_date: input.contributionDate,
    },
  );
  if (transactionError) throw transactionError;
  if (typeof transactionId !== "string") {
    throw new Error("Respons transaksi target dari Supabase tidak valid.");
  }
  const { data, error } = await client
    .from("savings_goal_contributions")
    .select(GOAL_CONTRIBUTION_COLUMNS)
    .eq("transaction_id", transactionId)
    .single();
  if (error) throw error;
  return {
    id: String(data.id),
    goalId: String(data.goal_id),
    transactionId: data.transaction_id
      ? String(data.transaction_id)
      : undefined,
    amount: Number(data.amount),
    contributionDate: String(data.contribution_date),
    createdAt: String(data.created_at),
    updatedAt: String(data.created_at),
  };
}

export async function reduceGoalContribution(
  goalId: string,
  amount: number,
  accountId: string,
  requestId: string,
  contributionDate: string,
): Promise<void> {
  assertPositiveInteger(amount, "amount");
  assertDate(contributionDate, "contributionDate");
  const client = getSupabaseBrowserClient();
  const { data: goal, error: goalError } = await client
    .from("savings_goals")
    .select("id, owner_user_id, family_id, name")
    .eq("id", goalId)
    .maybeSingle();
  if (goalError) throw goalError;
  if (!goal) throw new Error("Target tabungan tidak ditemukan.");
  const account = await assertAccountInGoalScope(accountId, goal, client);
  const transactionScope = {
    owner_user_id: account.owner_user_id,
    family_id: account.family_id,
    name: goal.name,
  };
  const categoryId = await getOrCreateGoalCategory(
    transactionScope,
    "income",
    client,
  );
  const { error } = await client.rpc("reduce_goal_contribution", {
    target_goal_id: goalId,
    target_request_id: requestId,
    target_amount: amount,
    target_account_id: accountId,
    target_category_id: categoryId,
    target_date: contributionDate,
  });
  if (error) throw error;
}

async function getOrCreateGoalCategory(
  goal: {
    owner_user_id: string | null;
    family_id: string | null;
    name: string;
  },
  transactionType: TransactionType,
  client: ReturnType<typeof getSupabaseBrowserClient>,
): Promise<string> {
  const scopeColumn = goal.family_id ? "family_id" : "owner_user_id";
  const scopeValue = goal.family_id ?? goal.owner_user_id;
  let query = client
    .from("categories")
    .select("id")
    .eq("name", "Target keuangan")
    .eq("category_type", transactionType);
  query =
    scopeValue === null
      ? query.is(scopeColumn, null)
      : query.eq(scopeColumn, scopeValue);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (data?.id) return String(data.id);
  const { data: created, error: createError } = await client
    .from("categories")
    .insert({
      id: id(),
      owner_user_id: goal.owner_user_id,
      family_id: goal.family_id,
      name: "Target keuangan",
      category_type: transactionType,
    })
    .select("id")
    .single();
  if (createError) throw createError;
  return String(created.id);
}

async function assertAccountInGoalScope(
  accountId: string,
  goal: { owner_user_id: string | null; family_id: string | null },
  client: ReturnType<typeof getSupabaseBrowserClient>,
): Promise<{
  owner_user_id: string | null;
  family_id: string | null;
}> {
  if (!accountId) throw new Error("Pilih akun sumber atau akun tujuan.");
  const { data, error } = await client
    .from("wallets")
    .select("id, owner_user_id, family_id")
    .eq("id", accountId)
    .maybeSingle();
  if (error)
    throw new Error(`Akun dana tidak dapat diperiksa: ${error.message}`);
  const userId = await currentUserId();
  const sameScope = goal.family_id
    ? data?.family_id === goal.family_id ||
      (data?.owner_user_id === userId && data?.family_id === null)
    : data?.owner_user_id === goal.owner_user_id && data?.family_id === null;
  if (!data || !sameScope) {
    throw new Error("Akun harus berada pada lingkup yang sama dengan target.");
  }
  return {
    owner_user_id:
      typeof data.owner_user_id === "string" ? data.owner_user_id : null,
    family_id: typeof data.family_id === "string" ? data.family_id : null,
  };
}

export async function listGoalProgress(): Promise<GoalProgress[]> {
  const client = getSupabaseBrowserClient();
  const [goalRows, savedByGoalId] = await Promise.all([
    fetchAllRows((from, to) =>
      client
        .from("savings_goals")
        .select(GOAL_COLUMNS)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    getGoalContributionTotals(),
  ]);
  const goals = goalRows.map((data) => ({
    id: String(data.id),
    ownerUserId:
      typeof data.owner_user_id === "string"
        ? String(data.owner_user_id)
        : undefined,
    familyId:
      typeof data.family_id === "string" ? String(data.family_id) : undefined,
    scopeType: data.family_id ? ("family" as const) : ("personal" as const),
    name: String(data.name),
    targetAmount: Number(data.target_amount),
    targetDate: data.target_date ? String(data.target_date) : undefined,
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  }));
  return goals.map((goal) => {
    const saved = savedByGoalId.get(goal.id) ?? 0;
    return {
      goal,
      saved,
      remaining: Math.max(goal.targetAmount - saved, 0),
      percentage: Math.min((saved / goal.targetAmount) * 100, 100),
    };
  });
}
