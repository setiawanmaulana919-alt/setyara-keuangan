"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

import type { LoanDirection, LoanRecord } from "@/features/loans/types";

export type { LoanDirection, LoanRecord } from "@/features/loans/types";

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
}): Promise<void> {
  if (
    !Number.isSafeInteger(input.principalAmount) ||
    input.principalAmount < 1
  ) {
    throw new Error("Jumlah harus berupa bilangan bulat lebih besar dari nol.");
  }
  const { error } = await getSupabaseBrowserClient().rpc(
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
}): Promise<void> {
  if (
    !Number.isSafeInteger(input.principalAmount) ||
    input.principalAmount < 1
  ) {
    throw new Error("Jumlah harus berupa bilangan bulat lebih besar dari nol.");
  }
  const { error } = await getSupabaseBrowserClient().rpc("update_loan_record", {
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
}): Promise<void> {
  if (!Number.isSafeInteger(input.amount) || input.amount < 1) {
    throw new Error(
      "Jumlah pembayaran harus berupa bilangan bulat lebih besar dari nol.",
    );
  }
  const { error } = await getSupabaseBrowserClient().rpc(
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
}
