import type {
  FinancialTransaction,
  ScopeType,
  TransactionType,
} from "@/types/data-model";

export interface TransactionInput {
  accountId: string;
  categoryId: string;
  transactionType: TransactionType;
  amount: number;
  transactionDate: string;
  note?: string;
  scopeType?: ScopeType;
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  transferDate: string;
  note?: string;
  scopeType?: ScopeType;
  requestId?: string;
}

export interface TransactionPeriodTotal {
  periodStart: string;
  transactionType: TransactionType;
  categoryId?: string;
  amount: number;
}

export interface TransactionPage {
  transactions: FinancialTransaction[];
  nextCursor: TransactionCursor | null;
  hasNextPage: boolean;
}

export interface TransactionCursor {
  transactionDate: string;
  id: string;
}
