"use client";

import type { AuthResponse, Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./browser";

function isMissingUsernameColumnError(reason: {
  code?: string;
  message?: string;
}): boolean {
  const message = reason.message?.toLowerCase() ?? "";
  return (
    message.includes("username") &&
    (reason.code === "42703" ||
      reason.code === "PGRST204" ||
      message.includes("column") ||
      message.includes("schema cache") ||
      message.includes("does not exist"))
  );
}

export async function signInWithPassword(
  identifier: string,
  password: string,
): Promise<AuthResponse> {
  if (!identifier.trim() || !password) {
    throw new Error("Username/email dan password wajib diisi.");
  }
  let email = identifier.trim();
  if (!email.includes("@")) {
    const { data, error } = await getSupabaseBrowserClient().rpc(
      "lookup_login_email",
      { login_username: email },
    );
    if (error) throw error;
    if (typeof data !== "string" || !data) {
      throw new Error("Username tidak ditemukan.");
    }
    email = data;
  }
  return getSupabaseBrowserClient().auth.signInWithPassword({
    email,
    password,
  });
}

export async function signUpWithPassword(
  email: string,
  password: string,
  profile: { username: string },
): Promise<AuthResponse> {
  if (!email.trim() || password.length < 8) {
    throw new Error("Email wajib diisi dan password minimal 8 karakter.");
  }
  if (!profile?.username?.trim()) {
    throw new Error("Username wajib diisi.");
  }

  return getSupabaseBrowserClient().auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        username: profile.username.trim().toLowerCase(),
      },
    },
  });
}

export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<AuthResponse> {
  if (!email.trim() || !/^\d{8}$/.test(code.trim())) {
    throw new Error("Masukkan kode verifikasi email 8 digit.");
  }

  return getSupabaseBrowserClient().auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: "signup",
  });
}

export async function sendPasswordChangeCode(email: string): Promise<void> {
  if (!email.trim()) throw new Error("Email akun tidak tersedia.");
  const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function verifyPasswordChangeCode(
  email: string,
  code: string,
): Promise<AuthResponse> {
  if (!email.trim() || !/^\d{8}$/.test(code.trim())) {
    throw new Error("Masukkan kode verifikasi email 8 digit.");
  }

  return getSupabaseBrowserClient().auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: "email",
  });
}

export async function verifyEmailChangeCode(
  email: string,
  code: string,
): Promise<AuthResponse> {
  if (!email.trim() || !/^\d{8}$/.test(code.trim())) {
    throw new Error("Masukkan kode verifikasi email 8 digit.");
  }
  return getSupabaseBrowserClient().auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: "email_change",
  });
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await getSupabaseBrowserClient().auth.getUser();
  if (error) {
    if (
      error.name === "AuthSessionMissingError" ||
      error.message.toLowerCase().includes("no user")
    ) {
      return null;
    }
    throw error;
  }
  return data.user;
}

export interface UserProfileSummary {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export async function getUserProfiles(
  userIds: string[],
): Promise<Map<string, UserProfileSummary>> {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) return new Map();

  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", uniqueUserIds);

  let rows: Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }> | null = data;

  if (error) {
    if (!isMissingUsernameColumnError(error)) throw error;
    const fallback = await client
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", uniqueUserIds);
    if (fallback.error) throw fallback.error;
    rows =
      fallback.data?.map((row) => ({
        ...row,
        username: null,
      })) ?? null;
  }

  return new Map(
    (rows ?? []).map((row) => [
      row.id,
      {
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
      },
    ]),
  );
}

export async function getUserProfile(
  userId: string,
): Promise<UserProfileSummary | null> {
  const profiles = await getUserProfiles([userId]);
  return profiles.get(userId) ?? null;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseBrowserClient().auth.signOut();
  if (error) throw error;
}

export async function updateUserProfile(input: {
  username?: string;
  name?: string;
  avatarUrl?: string;
}): Promise<User> {
  const normalizedUsername = input.username?.trim().toLowerCase();
  if (
    normalizedUsername !== undefined &&
    !/^[a-z0-9_]{3,30}$/.test(normalizedUsername)
  ) {
    throw new Error(
      "Username wajib diisi dengan 3–30 karakter berupa huruf, angka, atau garis bawah.",
    );
  }

  const client = getSupabaseBrowserClient();
  const {
    data: { user: currentUser },
    error: currentUserError,
  } = await client.auth.getUser();
  if (currentUserError) throw currentUserError;
  if (!currentUser) throw new Error("Sesi login tidak tersedia.");
  let avatarUrl = input.avatarUrl;
  if (avatarUrl?.startsWith("data:")) {
    const match = avatarUrl.match(
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
    );
    if (!match) {
      throw new Error("Foto profil harus berupa JPEG, PNG, atau WebP.");
    }
    const [, contentType, encoded] = match;
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    if (bytes.byteLength > 2 * 1024 * 1024) {
      throw new Error("Ukuran foto profil maksimal 2 MB.");
    }
    const { error: uploadError } = await client.storage
      .from("profile-avatars")
      .upload(`${currentUser.id}/avatar`, bytes, {
        cacheControl: "0",
        contentType,
        upsert: true,
      });
    if (uploadError) throw uploadError;
    const publicUrl = client.storage
      .from("profile-avatars")
      .getPublicUrl(`${currentUser.id}/avatar`).data.publicUrl;
    avatarUrl = `${publicUrl}?v=${Date.now()}`;
  }

  if (
    normalizedUsername !== undefined ||
    input.name !== undefined ||
    avatarUrl !== undefined
  ) {
    const profileValues = {
      ...(normalizedUsername !== undefined
        ? { username: normalizedUsername }
        : {}),
      ...(input.name !== undefined
        ? { display_name: input.name.trim() || null }
        : {}),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl || null } : {}),
      updated_at: new Date().toISOString(),
    };
    const profileUpdate = await client
      .from("profiles")
      .update({
        ...profileValues,
      })
      .eq("id", currentUser.id)
      .select("id")
      .maybeSingle();
    if (profileUpdate.error) {
      if (!isMissingUsernameColumnError(profileUpdate.error)) {
        throw profileUpdate.error;
      }
      const fallbackUpdate = await client
        .from("profiles")
        .update({
          ...(input.name !== undefined
            ? { display_name: input.name.trim() || null }
            : {}),
          ...(avatarUrl !== undefined ? { avatar_url: avatarUrl || null } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentUser.id)
        .select("id")
        .maybeSingle();
      if (fallbackUpdate.error) throw fallbackUpdate.error;
      if (!fallbackUpdate.data) {
        const fallbackInsert = await client
          .from("profiles")
          .insert({
            id: currentUser.id,
            ...(input.name !== undefined
              ? { display_name: input.name.trim() || null }
              : {}),
            ...(avatarUrl !== undefined
              ? { avatar_url: avatarUrl || null }
              : {}),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (fallbackInsert.error) throw fallbackInsert.error;
      }
    } else if (!profileUpdate.data) {
      const profileInsert = await client
        .from("profiles")
        .insert({ id: currentUser.id, ...profileValues })
        .select("id")
        .single();
      if (profileInsert.error) throw profileInsert.error;
    }
  }

  const { data, error } = await client.auth.updateUser({
    data: {
      ...(normalizedUsername !== undefined
        ? { username: normalizedUsername }
        : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Profil gagal diperbarui.");
  return data.user;
}

export async function updateUserEmail(email: string): Promise<User> {
  if (!email.trim()) throw new Error("Email wajib diisi.");
  const { data, error } = await getSupabaseBrowserClient().auth.updateUser({
    email: email.trim(),
  });
  if (error) throw error;
  if (!data.user) throw new Error("Email gagal diperbarui.");
  return data.user;
}

export async function updateUserPassword(password: string): Promise<User> {
  if (password.length < 8) {
    throw new Error("Password baru minimal 8 karakter.");
  }
  const { data, error } = await getSupabaseBrowserClient().auth.updateUser({
    password,
  });
  if (error) throw error;
  if (!data.user) throw new Error("Password gagal diperbarui.");
  return data.user;
}
