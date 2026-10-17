export type LoanDirection = "receivable" | "payable";

export interface LoanRecord {
  id: string;
  direction: LoanDirection;
  counterpartyName: string;
  principalAmount: number;
  remainingAmount: number;
  accountId: string;
  accountName: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  repaymentCount: number;
}

export interface LoanActivity {
  id: string;
  kind: "issued" | "repayment";
  loanId: string;
  direction: LoanDirection;
  counterpartyName: string;
  amount: number;
  accountId: string;
  activityDate: string;
  note?: string;
  createdAt: string;
}
