import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return response({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return response({ error: "Login diperlukan." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response(
      { error: "Konfigurasi server Supabase belum lengkap." },
      500,
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return response({ error: "Sesi tidak valid." }, 401);

  let body: { familyId?: unknown; email?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return response({ error: "Body JSON tidak valid." }, 400);
  }
  const familyId =
    typeof body.familyId === "string" ? body.familyId.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role === "editor" ? "editor" : "viewer";
  if (!/^[0-9a-f-]{36}$/i.test(familyId) || !isEmail(email)) {
    return response({ error: "Family ID atau email tidak valid." }, 400);
  }

  const { data: family, error: familyError } = await userClient
    .from("families")
    .select("id")
    .eq("id", familyId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (familyError) return response({ error: familyError.message }, 500);
  if (!family)
    return response(
      { error: "Hanya owner yang dapat mengundang anggota." },
      403,
    );

  const { data: existingMembers, error: memberError } = await adminClient
    .from("family_memberships")
    .select("id, user_id, status")
    .eq("family_id", familyId);
  if (memberError) return response({ error: memberError.message }, 500);

  const existingUser = existingMembers?.find(
    (member) => member.user_id === user.id,
  );
  if (!existingUser)
    return response({ error: "Membership owner tidak ditemukan." }, 409);

  const { data: invited, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email);
  if (inviteError) return response({ error: inviteError.message }, 400);
  if (!invited.user)
    return response({ error: "User undangan tidak dibuat." }, 502);

  const { error: upsertError } = await adminClient
    .from("family_memberships")
    .upsert(
      {
        family_id: familyId,
        user_id: invited.user.id,
        role,
        status: "invited",
      },
      { onConflict: "family_id,user_id" },
    );
  if (upsertError) return response({ error: upsertError.message }, 500);

  return response({ invited: true, email, role });
});
