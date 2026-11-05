"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import type {
  LoanActivity,
  LoanDirection,
  LoanRecord,
} from "@/features/loans/types";

export type { LoanDirection, LoanRecord } from "@/features/loans/types";

export async function listLoanActivities(): Promise<LoanActivity[]> {
  const client = getSupabaseBrowserClient();
  const [
    { data: loans, error: loansError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    client
      .from("loans")
      .select(
        "id, direction, counterparty_name, principal_amount, account_id, issue_date, notes, created_at",
      )
      .order("issue_date", { ascending: false }),
    client
      .from("loan_payments")
      .select(
        "id, loan_id, account_id, amount, repayment_date, notes, created_at",
      )
      .order("repayment_date", { ascending: false }),
  ]);
  if (loansError) throw loansError;
  if (paymentsError) throw paymentsError;
  const loanById = new Map(
    (loans ?? []).map((loan) => [
      String(loan.id),
      {
        direction: loan.direction as LoanDirection,
        counterpartyName: String(loan.counterparty_name),
      },
    ]),
  );
  const activities: LoanActivity[] = (loans ?? []).map((loan) => ({
    id: String(loan.id),
    kind: "issued",
    loanId: String(loan.id),
    direction: loan.direction as LoanDirection,
    counterpartyName: String(loan.counterparty_name),
    amount: safeInteger(loan.principal_amount, "jumlah pinjaman"),
    accountId: String(loan.account_id),
    activityDate: String(loan.issue_date),
    ...(typeof loan.notes === "string" ? { note: loan.notes } : {}),
    createdAt: String(loan.created_at),
  }));
  for (const payment of payments ?? []) {
    const loan = loanById.get(String(payment.loan_id));
    if (!loan) continue;
    activities.push({
      id: String(payment.id),
      kind: "repayment",
      loanId: String(payment.loan_id),
      direction: loan.direction,
      counterpartyName: loan.counterpartyName,
      amount: safeInteger(payment.amount, "jumlah pembayaran"),
      accountId: String(payment.account_id),
      activityDate: String(payment.repayment_date),
      ...(typeof payment.notes === "string" ? { note: payment.notes } : {}),
      createdAt: String(payment.created_at),
    });
  }
  return activities.sort(
    (left, right) =>
      right.activityDate.localeCompare(left.activityDate) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
}

function safeInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Nilai ${field} dari Supabase tidak valid.`);
  }
  return number;
}

export async function listLoanRecords(): Promise<LoanRecord[]> {
  const { data, error } =
    await getSupabaseBrowserClient().rpc("list_loan_records");
  if (error) throw error;
  if (!Array.isArray(data)) {
    throw new Error("Respons daftar piutang dan utang tidak valid.");
  }

  return data.map((row) => {
    if (
      typeof row.id !== "string" ||
      (row.direction !== "receivable" && row.direction !== "payable") ||
      typeof row.counterparty_name !== "string" ||
      typeof row.account_id !== "string" ||
      typeof row.account_name !== "string" ||
      typeof row.issue_date !== "string" ||
      (row.due_date !== null && typeof row.due_date !== "string") ||
      (row.notes !== null && typeof row.notes !== "string")
    ) {
      throw new Error("Respons daftar piutang dan utang tidak valid.");
    }
    const principalAmount = safeInteger(
      row.principal_amount,
      "jumlah pinjaman",
    );
    const remainingAmount = safeInteger(row.remaining_amount, "sisa pinjaman");
    if (remainingAmount > principalAmount) {
      throw new Error("Sisa pinjaman dari Supabase tidak valid.");
    }
    return {
      id: row.id,
      direction: row.direction,
      counterpartyName: row.counterparty_name,
      principalAmount,
      remainingAmount,
      accountId: row.account_id,
      accountName: row.account_name,
      issueDate: row.issue_date,
      ...(row.due_date ? { dueDate: row.due_date } : {}),
      ...(row.notes ? { notes: row.notes } : {}),
      repaymentCount: safeInteger(row.repayment_count, "jumlah pembayaran"),
    };
  });
}

export async function createLoanRecord(input: {
  requestId: string;
  direction: LoanDirection;
  counterpartyName: string;
  principalAmount: number;
  accountId: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  recordedAt?: string;
}): Promise<void> {
  if (
    !Number.isSafeInteger(input.principalAmount) ||
    input.principalAmount < 1
  ) {
    throw new Error("Jumlah harus berupa bilangan bulat lebih besar dari nol.");
  }
  const client = getSupabaseBrowserClient();
  const { data: loanId, error } = await client.rpc(
    "create_loan_record_idempotent",
    {
      target_request_id: input.requestId,
      target_direction: input.direction,
      target_counterparty_name: input.counterpartyName.trim(),
      target_principal_amount: input.principalAmount,
      target_account_id: input.accountId,
      target_issue_date: input.issueDate,
      target_due_date: input.dueDate || null,
      target_notes: input.notes?.trim() || null,
    },
  );
  if (error) throw error;
  if (input.recordedAt && typeof loanId === "string") {
    const { error: timestampError } = await client.rpc(
      "set_loan_recorded_at",
      {
        target_loan_id: loanId,
        target_recorded_at: input.recordedAt,
      },
    );
    if (timestampError) throw timestampError;
  }
}

export async function updateLoanRecord(input: {
  loanId: string;
  direction: LoanDirection;
  counterpartyName: string;
  principalAmount: number;
  accountId: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  recordedAt?: string;
}): Promise<void> {
  if (
    !Number.isSafeInteger(input.principalAmount) ||
    input.principalAmount < 1
  ) {
    throw new Error("Jumlah harus berupa bilangan bulat lebih besar dari nol.");
  }
  const client = getSupabaseBrowserClient();
  const { error } = await client.rpc("update_loan_record", {
    target_loan_id: input.loanId,
    target_direction: input.direction,
    target_counterparty_name: input.counterpartyName.trim(),
    target_principal_amount: input.principalAmount,
    target_account_id: input.accountId,
    target_issue_date: input.issueDate,
    target_due_date: input.dueDate || null,
    target_notes: input.notes?.trim() || null,
  });
  if (error) throw error;
  if (input.recordedAt) {
    const { error: timestampError } = await client.rpc(
      "set_loan_recorded_at",
      {
        target_loan_id: input.loanId,
        target_recorded_at: input.recordedAt,
      },
    );
    if (timestampError) throw timestampError;
  }
}

export async function deleteLoanRecord(loanId: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient().rpc("delete_loan_record", {
    target_loan_id: loanId,
  });
  if (error) throw error;
}

export async function recordLoanRepayment(input: {
  requestId: string;
  loanId: string;
  accountId: string;
  amount: number;
  repaymentDate: string;
  notes?: string;
  recordedAt?: string;
}): Promise<void> {
  if (!Number.isSafeInteger(input.amount) || input.amount < 1) {
    throw new Error(
      "Jumlah pembayaran harus berupa bilangan bulat lebih besar dari nol.",
    );
  }
  const client = getSupabaseBrowserClient();
  const { data: paymentId, error } = await client.rpc(
    "record_loan_repayment_idempotent",
    {
      target_request_id: input.requestId,
      target_loan_id: input.loanId,
      target_account_id: input.accountId,
      target_amount: input.amount,
      target_repayment_date: input.repaymentDate,
      target_notes: input.notes?.trim() || null,
    },
  );
  if (error) throw error;
  if (input.recordedAt && typeof paymentId === "string") {
    const { error: timestampError } = await client.rpc(
      "set_loan_payment_recorded_at",
      {
        target_payment_id: paymentId,
        target_recorded_at: input.recordedAt,
      },
    );
    if (timestampError) throw timestampError;
  }
}
