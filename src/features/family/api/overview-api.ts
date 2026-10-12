import { getCurrentUser, getUserProfiles } from "@/lib/supabase/auth";
import {
  getActiveFamilyJoinCode,
  listActiveMembers,
  listFamilies,
  listFamilyMemberFinanceSummaries,
  type ActiveFamilyJoinCode,
  type Family,
  type FamilyMember,
  type FamilyMemberFinanceSummary,
} from "@/features/family/api/family-api";

function isFamilyUnavailable(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const candidate = reason as { code?: string; status?: number };
  return candidate.status === 403 || candidate.code === "42501";
}

export async function loadFamilyOverview() {
  const user = await getCurrentUser();
  if (!user) return { userId: null };

  let families: Family[] = [];
  try {
    families = await listFamilies();
  } catch (reason) {
    if (!isFamilyUnavailable(reason)) throw reason;
  }

  const entries = await Promise.all(
    families.map(async (family) => {
      try {
        return [family.id, await listActiveMembers(family.id)] as const;
      } catch (reason) {
        if (isFamilyUnavailable(reason)) return [family.id, []] as const;
        throw reason;
      }
    }),
  );
  const familyMembers = entries.flatMap(([, members]) => members);
  const [financeEntries, profiles, codeEntries] = await Promise.all([
    Promise.all(
      entries.map(async ([familyId, members]) => {
        const summaries = await listFamilyMemberFinanceSummaries(
          familyId,
          members.map((member) => member.user_id),
        );
        return [
          familyId,
          Object.fromEntries(
            summaries.map((summary) => [summary.userId, summary]),
          ),
        ] as const;
      }),
    ),
    getUserProfiles(familyMembers.map((member) => member.user_id)),
    Promise.all(
      families.map(async (family) => {
        if (family.owner_user_id !== user.id) return [family.id, null] as const;
        try {
          return [family.id, await getActiveFamilyJoinCode(family.id)] as const;
        } catch (reason) {
          if (isFamilyUnavailable(reason)) return [family.id, null] as const;
          throw reason;
        }
      }),
    ),
  ]);
  const usernameEntries = familyMembers.map((member) => {
    const profile = profiles.get(member.user_id);
    return [
      member.user_id,
      profile?.username || profile?.displayName || "Anggota keluarga",
    ] as const;
  });

  return {
    userId: user.id,
    families,
    members: Object.fromEntries(entries),
    memberUsernames: Object.fromEntries(usernameEntries),
    activeCodes: Object.fromEntries(codeEntries),
    memberFinances: Object.fromEntries(financeEntries),
  };
}

export type FamilyOverview = Exclude<
  Awaited<ReturnType<typeof loadFamilyOverview>>,
  { userId: null }
>;

export type {
  ActiveFamilyJoinCode,
  Family,
  FamilyMember,
  FamilyMemberFinanceSummary,
};
