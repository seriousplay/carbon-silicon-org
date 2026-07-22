import "server-only";

import { cookies, headers } from "next/headers";
import { createOpaqueToken, hashToken } from "./auth-crypto";
import { extractCookieValues, uniqueCookieValues } from "./session-cookie";
import { getAdminClient } from "./supabase";
import { activateEnterprise } from "./enterprise";
import type { PrismaClient } from "@prisma/client";

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
  tenantKey: string;
  enterpriseId: string | null;
  openId: string;
  unionId: string | null;
  feishuUserId: string | null;
  displayName: string;
  avatarUrl: string | null;
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
    tenantKey: row.tenantKey,
    enterpriseId: row.enterpriseId ?? "",
    openId: row.openId,
    unionId: row.unionId,
    feishuUserId: row.feishuUserId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  };
}

export async function createAppSession(user: AppUser, options?: { skipEnterpriseActivation?: boolean }) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const token = createOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + sessionTtlSeconds() * 1000);

  if (options?.skipEnterpriseActivation) {
    await admin.loopDesignerAuthSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
    await setCompatibleCookie(APP_SESSION_COOKIE, token, expiresAt);
    return;
  }

  // Atomic operation: create session + activate enterprise in one transaction
  try {
    await (admin as PrismaClient).$transaction(async (tx) => {
      // 1. Activate enterprise (get or create)
      const enterprise = await activateEnterprise({
        tenantKey: user.tenantKey,
        companyName: user.displayName,
        displayName: user.displayName,
      });

      // 2. Ensure user is linked to enterprise
      await tx.loopDesignerUser.update({
        where: { id: user.id },
        data: { enterpriseId: enterprise.id },
      });

      // 3. Increment used seats
      await tx.loopDesignerEnterprise.update({
        where: { id: enterprise.id },
        data: { usedSeats: { increment: 1 } },
      });

      // 4. Create auth session
      await tx.loopDesignerAuthSession.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });
  } catch {
    // Fallback: legacy non-atomic approach
    const enterprise = await activateEnterprise({
      tenantKey: user.tenantKey,
      companyName: user.displayName,
      displayName: user.displayName,
    });

    await admin.loopDesignerUser.update({
      where: { id: user.id },
      data: { enterpriseId: enterprise.id },
    });

    await admin.loopDesignerEnterprise.update({
      where: { id: enterprise.id },
      data: { usedSeats: { increment: 1 } },
    });

    await admin.loopDesignerAuthSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
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
  const now = new Date();

  for (const token of tokenCandidates) {
    const tokenHash = hashToken(token);
    const session = await admin.loopDesignerAuthSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true, userId: true },
    });
    if (!session) continue;

    const user = await admin.loopDesignerUser.findFirst({
      where: {
        id: session.userId,
        status: "active",
      },
      select: {
        id: true,
        tenantKey: true,
        enterpriseId: true,
        openId: true,
        unionId: true,
        feishuUserId: true,
        displayName: true,
        avatarUrl: true,
      },
    });
    if (!user) continue;

    const enterprise = await admin.loopDesignerEnterprise.findFirst({
      where: { id: user.enterpriseId! },
      select: { isActive: true },
    });
    if (!enterprise?.isActive) continue;

    void admin.loopDesignerAuthSession.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
    return normalizeUser(user as UserRow);
  }

  return null;
}

export async function revokeCurrentAppSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(APP_SESSION_COOKIE)?.value;
  const admin = getAdminClient();
  if (token && admin) {
    // Get user info to release seat
    const hashedToken = hashToken(token);
    const session = await admin.loopDesignerAuthSession.findFirst({
      where: {
        tokenHash: hashedToken,
        revokedAt: null,
      },
      select: { userId: true },
    });

    if (session) {
      const user = await admin.loopDesignerUser.findFirst({
        where: { id: session.userId },
        select: { id: true, enterpriseId: true },
      });

      if (user) {
        await releaseUserSeat(user.id, user.enterpriseId ?? "");
      }
    }

    await admin.loopDesignerAuthSession.updateMany({
      where: { tokenHash: hashedToken },
      data: { revokedAt: new Date() },
    });
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
 * Phase 1: Release enterprise seat
 */
async function releaseUserSeat(userId: string, enterpriseId: string) {
  if (!enterpriseId) return;
  const admin = getAdminClient();
  if (!admin) return;
  await admin.loopDesignerEnterprise.update({
    where: { id: enterpriseId },
    data: { usedSeats: { decrement: 1 } },
  });
}
