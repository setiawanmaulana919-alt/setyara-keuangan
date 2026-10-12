"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type FamilyRole = "owner" | "editor" | "viewer";
export type MembershipStatus = "active" | "invited" | "removed";

export interface Family {
  id: string;
  owner_user_id: string;
  name: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyRole;
  status: MembershipStatus;
  created_at: string;
}

export interface FamilyMemberFinanceSummary {
  userId: string;
  totalBalance: number;
  sourceTotal: number;
  investmentTotal: number;
  receivableTotal: number;
  sourceCount: number;
  investmentCount: number;
  receivableCount: number;
  loanReceivableTotal: number;
  loanPayableTotal: number;
  loanReceivableCount: number;
  loanPayableCount: number;
}

export async function listFamilyMemberFinanceSummaries(
  familyId: string,
  memberUserIds: string[],
): Promise<FamilyMemberFinanceSummary[]> {
  assertUuid(familyId, "familyId");
  if (memberUserIds.length === 0) return [];

  const client = getSupabaseBrowserClient();
  const { data, error } = await client.rpc(
    "get_family_member_finance_summary",
    { target_family_id: familyId },
  );
  if (error) throw error;
  const allowedUsers = new Set(memberUserIds);
  const rows = (data ?? []) as Array<{
    user_id: unknown;
    total_balance: unknown;
    source_total: unknown;
    investment_total: unknown;
    receivable_total: unknown;
    source_count: unknown;
    investment_count: unknown;
    receivable_count: unknown;
    loan_receivable_total: unknown;
    loan_payable_total: unknown;
    loan_receivable_count: unknown;
    loan_payable_count: unknown;
  }>;
  return rows
    .filter(
      (
        row,
      ): row is {
        user_id: string;
        total_balance: unknown;
        source_total: unknown;
        investment_total: unknown;
        receivable_total: unknown;
        source_count: unknown;
        investment_count: unknown;
        receivable_count: unknown;
        loan_receivable_total: unknown;
        loan_payable_total: unknown;
        loan_receivable_count: unknown;
        loan_payable_count: unknown;
      } => typeof row.user_id === "string" && allowedUsers.has(row.user_id),
    )
    .map((row) => ({
      userId: row.user_id,
      totalBalance: Number(row.total_balance),
      sourceTotal: Number(row.source_total),
      investmentTotal: Number(row.investment_total),
      receivableTotal: Number(row.receivable_total),
      sourceCount: Number(row.source_count),
      investmentCount: Number(row.investment_count),
      receivableCount: Number(row.receivable_count),
      loanReceivableTotal: Number(row.loan_receivable_total),
      loanPayableTotal: Number(row.loan_payable_total),
      loanReceivableCount: Number(row.loan_receivable_count),
      loanPayableCount: Number(row.loan_payable_count),
    }));
}

function assertFamilyName(name: string): string {
  const value = name.trim();
  if (value.length < 1 || value.length > 100) {
    throw new Error("Nama keluarga harus memiliki 1-100 karakter.");
  }
  return value;
}

function assertUuid(value: string, field: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(value)) {
    throw new Error(`${field} tidak valid.`);
  }
}

export async function listFamilies(): Promise<Family[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("families")
    .select("id, owner_user_id, name, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Family[];
}

export async function createFamily(name: string): Promise<Family> {
  const userResponse = await getSupabaseBrowserClient().auth.getUser();
  if (userResponse.error) throw userResponse.error;
  if (!userResponse.data.user) throw new Error("Login diperlukan.");

  const { data, error } = await getSupabaseBrowserClient()
    .from("families")
    .insert({
      name: assertFamilyName(name),
      owner_user_id: userResponse.data.user.id,
    })
    .select("id, owner_user_id, name, created_at")
    .single();
  if (error) throw error;
  return data as Family;
}

export async function listActiveMembers(
  familyId: string,
): Promise<FamilyMember[]> {
  assertUuid(familyId, "familyId");
  const { data, error } = await getSupabaseBrowserClient()
    .from("family_memberships")
    .select("id, family_id, user_id, role, status, created_at")
    .eq("family_id", familyId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as FamilyMember[];
}

export async function updateMemberRole(
  memberId: string,
  role: Exclude<FamilyRole, "owner">,
): Promise<void> {
  assertUuid(memberId, "memberId");
  const { error } = await getSupabaseBrowserClient()
    .from("family_memberships")
    .update({ role })
    .eq("id", memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string): Promise<void> {
  assertUuid(memberId, "memberId");
  const { error } = await getSupabaseBrowserClient()
    .from("family_memberships")
    .update({ status: "removed" })
    .eq("id", memberId)
    .neq("role", "owner");
  if (error) throw error;
}

export async function inviteFamilyMember(
  familyId: string,
  email: string,
  role: Exclude<FamilyRole, "owner"> = "viewer",
): Promise<void> {
  assertUuid(familyId, "familyId");
  const value = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("Email anggota tidak valid.");
  }
  const { error } = await getSupabaseBrowserClient().functions.invoke(
    "invite-family-member",
    { body: { familyId, email: value, role } },
  );
  if (error) throw error;
}

export async function createFamilyJoinCode(
  familyId: string,
  role: Exclude<FamilyRole, "owner"> = "viewer",
): Promise<{
  code: string;
  role: Exclude<FamilyRole, "owner">;
  expiresInHours: number;
}> {
  assertUuid(familyId, "familyId");
  const { data, error } = await getSupabaseBrowserClient().functions.invoke(
    "family-invitation-code",
    { body: { action: "create", familyId, role } },
  );
  if (error) {
    const response = "context" in error ? error.context : undefined;
    if (response instanceof Response) {
      try {
        const payload = (await response.clone().json()) as { error?: string };
        if (payload.error) throw new Error(payload.error);
      } catch (reason) {
        if (reason instanceof Error && reason.message) throw reason;
      }
    }
    throw error;
  }

  return data as {
    code: string;
    role: Exclude<FamilyRole, "owner">;
    expiresInHours: number;
  };
}

export interface ActiveFamilyJoinCode {
  code: string;
  role: Exclude<FamilyRole, "owner">;
  expiresAt: string;
}

export async function getActiveFamilyJoinCode(
  familyId: string,
): Promise<ActiveFamilyJoinCode | null> {
  assertUuid(familyId, "familyId");
  const { data, error } = await getSupabaseBrowserClient()
    .from("family_invitations")
    .select("code_text, role, expires_at")
    .eq("family_id", familyId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data?.code_text || !data.role || !data.expires_at) return null;
  return {
    code: data.code_text,
    role: data.role as Exclude<FamilyRole, "owner">,
    expiresAt: data.expires_at,
  };
}

export async function joinFamilyWithCode(code: string): Promise<string> {
  const value = code.trim().toUpperCase();
  const { data, error } = await getSupabaseBrowserClient().functions.invoke(
    "family-invitation-code",
    { body: { action: "join", code: value } },
  );
  if (error) {
    const response = "context" in error ? error.context : undefined;
    if (response instanceof Response) {
      try {
        const payload = (await response.clone().json()) as { error?: string };
        if (payload.error) throw new Error(payload.error);
      } catch (reason) {
        if (reason instanceof Error && reason.message) throw reason;
      }
    }
    throw error;
  }
  return (data as { familyId: string }).familyId;
}

export async function leaveFamily(familyId: string): Promise<void> {
  assertUuid(familyId, "familyId");
  const { data, error } = await getSupabaseBrowserClient().functions.invoke(
    "family-invitation-code",
    { body: { action: "leave", familyId } },
  );
  if (error) throw error;
  if (!(data as { left?: boolean }).left) {
    throw new Error("Anda belum menjadi anggota keluarga tersebut.");
  }
}
