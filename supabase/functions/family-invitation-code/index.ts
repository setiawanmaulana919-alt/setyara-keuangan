import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const value = Array.from(bytes, (byte) =>
    byte.toString(36).padStart(2, "0"),
  ).join("");
  return `KEU-${value.slice(0, 8).toUpperCase()}`;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);

  const token = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token) return json({ error: "Login diperlukan." }, 401);
  if (!url || !anonKey || !serviceRoleKey) {
    return json({ error: "Konfigurasi server Supabase belum lengkap." }, 500);
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(url, serviceRoleKey);
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user)
    return json({ error: "Sesi tidak valid." }, 401);

  let body: {
    action?: unknown;
    familyId?: unknown;
    code?: unknown;
    role?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body JSON tidak valid." }, 400);
  }

  if (body.action === "active" || body.action === "create") {
    const familyId =
      typeof body.familyId === "string" ? body.familyId.trim() : "";
    const role = body.role === "editor" ? "editor" : "viewer";
    if (!/^[0-9a-f-]{36}$/i.test(familyId)) {
      return json({ error: "Family ID tidak valid." }, 400);
    }
    const { data: family } = await userClient
      .from("families")
      .select("id")
      .eq("id", familyId)
      .eq("owner_user_id", authData.user.id)
      .maybeSingle();
    if (!family)
      return json({ error: "Hanya owner yang dapat membuat kode." }, 403);

    const { data: activeInvitations, error: activeError } = await adminClient
      .from("family_invitations")
      .select("code_text, role, expires_at")
      .eq("family_id", familyId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    if (activeError) return json({ error: activeError.message }, 500);
    const activeInvitation = activeInvitations?.[0] ?? null;
    if (body.action === "active") {
      return json({
        code: activeInvitation?.code_text ?? null,
        role: activeInvitation?.role ?? null,
        expiresAt: activeInvitation?.expires_at ?? null,
      });
    }
    if (activeInvitation && !activeInvitation.code_text) {
      return json(
        {
          error:
            "Kode gabung lama masih aktif. Tunggu sampai kedaluwarsa sebelum membuat kode baru.",
        },
        409,
      );
    }
    if (activeInvitation?.code_text) {
      return json({
        code: activeInvitation.code_text,
        role: activeInvitation.role,
        expiresInHours: Math.max(
          1,
          Math.ceil(
            (new Date(activeInvitation.expires_at).getTime() - Date.now()) /
              3600000,
          ),
        ),
      });
    }

    const code = createCode();
    const { error } = await adminClient.from("family_invitations").insert({
      family_id: familyId,
      code_hash: await hashCode(code),
      code_text: code,
      role,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_by: authData.user.id,
    });
    if (error) return json({ error: error.message }, 500);
    return json({ code, role, expiresInHours: 24 });
  }

  if (body.action === "join") {
    const code =
      typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^KEU-[A-Z0-9]{8}$/.test(code)) {
      return json({ error: "Kode gabung tidak valid." }, 400);
    }
    const { data: invitation, error } = await adminClient
      .from("family_invitations")
      .select("family_id, role, expires_at, revoked_at")
      .eq("code_hash", await hashCode(code))
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (
      !invitation ||
      invitation.revoked_at ||
      new Date(invitation.expires_at) < new Date()
    ) {
      return json(
        { error: "Kode tidak ditemukan atau sudah kedaluwarsa." },
        400,
      );
    }
    const { error: membershipError } = await adminClient
      .from("family_memberships")
      .upsert(
        {
          family_id: invitation.family_id,
          user_id: authData.user.id,
          role: invitation.role,
          status: "active",
        },
        { onConflict: "family_id,user_id" },
      );
    if (membershipError) {
      return json(
        {
          error: "Gagal menambahkan anggota ke keluarga.",
          detail: membershipError.message,
          code: membershipError.code ?? null,
        },
        500,
      );
    }
    return json({ joined: true, familyId: invitation.family_id });
  }

  if (body.action === "leave") {
    const familyId =
      typeof body.familyId === "string" ? body.familyId.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(familyId)) {
      return json({ error: "Family ID tidak valid." }, 400);
    }
    const { data: membership, error: membershipLookupError } = await adminClient
      .from("family_memberships")
      .select("id, role, status")
      .eq("family_id", familyId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (membershipLookupError) {
      return json({ error: membershipLookupError.message }, 500);
    }
    if (!membership || membership.status !== "active") {
      return json(
        { error: "Anda belum menjadi anggota keluarga tersebut." },
        404,
      );
    }
    if (membership.role === "owner") {
      return json({ error: "Owner tidak dapat keluar dari keluarga." }, 403);
    }
    const { error: leaveError } = await adminClient
      .from("family_memberships")
      .update({ status: "removed" })
      .eq("id", membership.id);
    if (leaveError) return json({ error: leaveError.message }, 500);
    return json({ left: true, familyId });
  }

  return json({ error: "Action tidak dikenal." }, 400);
});
