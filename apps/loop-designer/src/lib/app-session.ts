import "server-only";

import { cookies, headers } from "next/headers";
import { createOpaqueToken, hashToken } from "./auth-crypto";
import { extractCookieValues, uniqueCookieValues } from "./session-cookie";
import { getAdminClient } from "./supabase";
import { activateEnterprise } from "./enterprise";

export const APP_SESSION_COOKIE = "loop_designer_session";
export const OAUTH_STATE_COOKIE = "loop_designer_oauth_state";
const PARTITIONED_SESSION_COOKIE = "loop_designer_session_partitioned";
const PARTITIONED_OAUTH_STATE_COOKIE = "loop_designer_oauth_state_partitioned";

export type AppUser = {
  id: string;
  tenantKey: string;
  enterpriseId: string;
  openId: string;
  unionId: string | null;
  feishuUserId: string | null;
  displayName: string;
  avatarUrl: string | null;
};

type UserRow = {
  id: string;
  tenant_key: string;
  enterprise_id: string;
  open_id: string;
  union_id: string | null;
  feishu_user_id: string | null;
  display_name: string;
  avatar_url: string | null;
};

function cookieOptions(expires?: Date) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/loop-designer",
    ...(expires ? { expires } : {}),
  };
}

function partitionedCookieOptions(expires?: Date) {
  return {
    ...cookieOptions(expires),
    partitioned: true,
  };
}

async function setCompatibleCookie(name: string, value: string, expires?: Date) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, cookieOptions(expires));
  if (process.env.NODE_ENV === "production") {
    cookieStore.set(`${name}_partitioned`, value, partitionedCookieOptions(expires));
  }
}

async function clearCompatibleCookie(name: string) {
  await setCompatibleCookie(name, "", new Date(0));
}

function sessionTtlSeconds() {
  const value = Number(process.env.LOOP_AUTH_SESSION_TTL_SECONDS || 60 * 60 * 24 * 14);
  return Number.isFinite(value) && value >= 3600 ? value : 60 * 60 * 24 * 14;
}

export function normalizeUser(row: UserRow): AppUser {
  return {
    id: row.id,
    tenantKey: row.tenant_key,
    enterpriseId: row.enterprise_id,
    openId: row.open_id,
    unionId: row.union_id,
    feishuUserId: row.feishu_user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

export async function createAppSession(user: AppUser, options?: { skipEnterpriseActivation?: boolean }) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const token = createOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + sessionTtlSeconds() * 1000);

  if (options?.skipEnterpriseActivation) {
    const { error } = await admin.from("loop_designer_auth_sessions").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });
    if (error) throw new Error(error.message);
    await setCompatibleCookie(APP_SESSION_COOKIE, token, expiresAt);
    return;
  }

  // Try atomic RPC first (all DB operations in one transaction)
  const { data: rpcResult, error: rpcError } = await admin.rpc(
    "create_app_session_atomic",
    {
      p_user_id: user.id,
      p_tenant_key: user.tenantKey,
      p_company_name: user.displayName,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt.toISOString(),
    }
  );

  if (rpcError || !rpcResult) {
    // Fallback: legacy non-atomic approach for environments without the RPC migration
    const enterprise = await activateEnterprise({
      tenantKey: user.tenantKey,
      companyName: user.displayName,
      displayName: user.displayName,
    });

    await admin
      .from("loop_designer_users")
      .update({ enterprise_id: enterprise.id })
      .eq("id", user.id);

    await admin
      .from("loop_designer_enterprises")
      .update({ used_seats: enterprise.usedSeats + 1 })
      .eq("id", enterprise.id);

    const { error } = await admin.from("loop_designer_auth_sessions").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  await setCompatibleCookie(APP_SESSION_COOKIE, token, expiresAt);
}

export async function readAppSession(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const tokenCandidates = uniqueCookieValues([
    ...cookieStore.getAll(APP_SESSION_COOKIE).map((cookie) => cookie.value),
    ...cookieStore.getAll(PARTITIONED_SESSION_COOKIE).map((cookie) => cookie.value),
    ...extractCookieValues(headerStore.get("cookie"), [APP_SESSION_COOKIE, PARTITIONED_SESSION_COOKIE]),
  ]);
  if (!tokenCandidates.length) return null;
  const admin = getAdminClient();
  if (!admin) return null;
  const now = new Date().toISOString();

  for (const token of tokenCandidates) {
    const { data: session } = await admin
      .from("loop_designer_auth_sessions")
      .select("id,user_id")
      .eq("token_hash", hashToken(token))
      .is("revoked_at", null)
      .gt("expires_at", now)
      .maybeSingle();
    if (!session) continue;

    const { data: user } = await admin
      .from("loop_designer_users")
      .select("id,tenant_key,enterprise_id,open_id,union_id,feishu_user_id,display_name,avatar_url")
      .eq("id", session.user_id)
      .eq("status", "active")
      .maybeSingle();
    if (!user) continue;

    const { data: enterprise } = await admin
      .from("loop_designer_enterprises")
      .select("is_active")
      .eq("id", user.enterprise_id)
      .maybeSingle();
    if (!enterprise?.is_active) continue;

    void admin
      .from("loop_designer_auth_sessions")
      .update({ last_seen_at: now })
      .eq("id", session.id);
    return normalizeUser(user as UserRow);
  }

  return null;
}

export async function revokeCurrentAppSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(APP_SESSION_COOKIE)?.value;
  const admin = getAdminClient();
  if (token && admin) {
    // 先获取用户信息以释放席位
    const hashedToken = hashToken(token);
    const { data: session } = await admin
      .from("loop_designer_auth_sessions")
      .select("user_id")
      .eq("token_hash", hashedToken)
      .is("revoked_at", null)
      .maybeSingle();

    if (session) {
      const { data: user } = await admin
        .from("loop_designer_users")
        .select("id,enterprise_id")
        .eq("id", session.user_id)
        .maybeSingle();

      if (user) {
        await releaseUserSeat(user.id, user.enterprise_id);
      }
    }

    await admin
      .from("loop_designer_auth_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashedToken);
  }
  await clearCompatibleCookie(APP_SESSION_COOKIE);
}

export async function setOAuthStateCookie(value: string) {
  await setCompatibleCookie(OAUTH_STATE_COOKIE, value, new Date(Date.now() + 10 * 60 * 1000));
}

export async function consumeOAuthStateCookie() {
  const cookieStore = await cookies();
  const value = cookieStore.get(OAUTH_STATE_COOKIE)?.value
    || cookieStore.get(PARTITIONED_OAUTH_STATE_COOKIE)?.value;
  await clearCompatibleCookie(OAUTH_STATE_COOKIE);
  return value;
}

/**
 * Phase 1: 释放企业席位
 */
async function releaseUserSeat(userId: string, enterpriseId: string | null) {
  if (!enterpriseId) return;
  const admin = getAdminClient();
  if (!admin) return;
  await admin.rpc("decrement_used_seats", { p_enterprise_id: enterpriseId });
}
