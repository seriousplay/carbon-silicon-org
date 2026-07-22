import "server-only";

import { getCurrentUser } from "./auth";
import { openExportGrant } from "./auth-crypto";
import { getAuthorizedSession } from "./sessions";
import type { AppUser } from "./app-session";

export async function authorizeExport(
  request: Request,
  sessionId: string,
  kind: "markdown" | "pdf",
) {
  const currentUser = await getCurrentUser();
  if (currentUser) return getAuthorizedSession(currentUser, sessionId);

  const secret = process.env.LOOP_AUTH_SESSION_SECRET;
  const grant = secret
    ? openExportGrant(new URL(request.url).searchParams.get("download"), secret)
    : null;
  if (!grant || grant.sessionId !== sessionId || grant.kind !== kind) return null;
  const grantUser: AppUser = {
    id: grant.userId,
    tenantKey: "",
    enterpriseId: "",
    openId: "",
    unionId: null,
    feishuUserId: null,
    displayName: "",
    avatarUrl: null,
  };
  return getAuthorizedSession(grantUser, sessionId);
}
