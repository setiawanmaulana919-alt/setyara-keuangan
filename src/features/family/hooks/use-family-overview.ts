import { useCallback, useEffect, useState } from "react";
import {
  type ActiveFamilyJoinCode,
  type Family,
  type FamilyMember,
  type FamilyMemberFinanceSummary,
} from "@/features/family/api/family-api";
import { loadFamilyOverview } from "@/features/family/api/overview-api";

function getMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Gagal memuat keluarga.";
}

export function useFamilyOverview() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Record<string, FamilyMember[]>>({});
  const [memberUsernames, setMemberUsernames] = useState<
    Record<string, string>
  >({});
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCodes, setActiveCodes] = useState<
    Record<string, ActiveFamilyJoinCode | null>
  >({});
  const [memberFinances, setMemberFinances] = useState<
    Record<string, Record<string, FamilyMemberFinanceSummary>>
  >({});

  const refresh = useCallback(async () => {
    setError("");
    const overview = await loadFamilyOverview();
    setUserId(overview.userId);
    if (!overview.userId) return;
    setFamilies(overview.families);
    setMembers(overview.members);
    setMemberUsernames(overview.memberUsernames);
    setActiveCodes(overview.activeCodes);
    setMemberFinances(overview.memberFinances);
  }, []);

  useEffect(() => {
    void Promise.resolve()
      .then(() => refresh())
      .catch((reason: unknown) => {
        setError(getMessage(reason));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [refresh]);

  return {
    families,
    members,
    memberUsernames,
    userId,
    loading,
    error,
    setError,
    activeCodes,
    setActiveCodes,
    memberFinances,
    refresh,
  };
}
