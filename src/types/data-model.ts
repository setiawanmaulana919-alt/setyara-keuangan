export type ScopeType = "personal" | "family";
export type TransactionType = "income" | "expense";

export interface DataRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScopedRecord extends DataRecord {
  scopeType: ScopeType;
  ownerUserId?: string;
  familyId?: string;
}

export interface Account extends ScopedRecord {
  name: string;
  accountType:
    "cash" | "bank" | "eWallet" | "investment" | "receivable" | "other";
  openingBalance: number;
  openingBalanceDate: string;
  investmentType?: "gold" | "deposit" | "crypto" | "stock";
  assetSymbol?: string;
  assetQuantity?: number;
  assetUnit?: "gram" | "kg" | "unit" | "lot";
  purchasePrice?: number;
  marketPrice?: number;
  marketUpdatedAt?: string;
  archivedAt?: string;
}

export interface Category extends ScopedRecord {
  name: string;
  transactionType: TransactionType;
  sortOrder: number;
  archivedAt?: string;
}

export interface FinancialTransaction extends ScopedRecord {
  accountId: string;
  categoryId: string;
  transactionType: TransactionType;
  amount: number;
  transactionDate: string;
  note?: string;
}

export interface Transfer extends ScopedRecord {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  transferDate: string;
  note?: string;
}

export interface Budget extends ScopedRecord {
  categoryId: string;
  amountLimit: number;
  periodStart: string;
  periodEnd: string;
}

export interface Asset extends ScopedRecord {
  name: string;
  assetType: string;
  acquisitionValue: number;
}

export interface AssetValuation extends DataRecord {
  assetId: string;
  valuationDate: string;
  marketValue: number;
}

export interface SavingsGoal extends ScopedRecord {
  name: string;
  targetAmount: number;
  targetDate?: string;
}

export interface GoalContribution extends DataRecord {
  goalId: string;
  transactionId?: string;
  amount: number;
  contributionDate: string;
}

export interface Preference extends DataRecord {
  key: string;
  value: unknown;
}
