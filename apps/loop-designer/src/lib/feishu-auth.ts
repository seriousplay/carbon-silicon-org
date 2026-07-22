import "server-only";

import { getEnterpriseByTenantKey } from "./enterprise";

export type FeishuUserInfo = {
  openId: string;
  unionId: string | null;
  userId: string | null;
  tenantKey: string;
  displayName: string;
  avatarUrl: string | null;
};

type TokenResponse = {
  code?: number;
  access_token?: string;
  error?: string;
  error_description?: string;
};

type UserInfoResponse = {
  code: number;
  msg?: string;
  data?: {
    open_id?: string;
    union_id?: string;
    user_id?: string;
    tenant_key?: string;
    name?: string;
    avatar_url?: string;
  };
};

function getFeishuConfig() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) throw new Error("飞书应用凭据尚未配置");
  return { appId, appSecret };
}

export function getOAuthCallbackUrl() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${siteUrl}/loop-designer/api/auth/feishu/callback`;
}

export function buildFeishuAuthorizeUrl(input: { state: string; challenge: string }) {
  const { appId } = getFeishuConfig();
  const url = new URL("https://accounts.feishu.cn/open-apis/authen/v1/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", getOAuthCallbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function exchangeAuthorizationCode(code: string, verifier: string) {
  const { appId, appSecret } = getFeishuConfig();
  const response = await fetch("https://open.feishu.cn/open-apis/authen/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: getOAuthCallbackUrl(),
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as TokenResponse;
  if (!response.ok || payload.code || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "飞书授权码交换失败");
  }
  return payload.access_token;
}

export async function fetchFeishuUserInfo(accessToken: string): Promise<FeishuUserInfo> {
  const response = await fetch("https://open.feishu.cn/open-apis/authen/v1/user_info", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    cache: "no-store",
  });
  const payload = (await response.json()) as UserInfoResponse;
  const data = payload.data;
  if (!response.ok || payload.code !== 0 || !data?.open_id || !data.tenant_key || !data.name) {
    throw new Error(payload.msg || "无法获取飞书用户信息");
  }
  return {
    openId: data.open_id,
    unionId: data.union_id || null,
    userId: data.user_id || null,
    tenantKey: data.tenant_key,
    displayName: data.name,
    avatarUrl: data.avatar_url || null,
  };
}

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isBeforeOpenAccessDeadline() {
  const value = process.env.FEISHU_OPEN_ACCESS_UNTIL;
  if (!value) return true;
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return false;
  return Date.now() <= deadline.getTime();
}

export async function assertTenantAccess(tenantKey: string) {
  const enterprise = await getEnterpriseByTenantKey(tenantKey);
  if (enterprise) {
    if (!enterprise.isActive) {
      throw new Error("该企业访问已关闭，请联系平台管理员");
    }
    return;
  }

  const allowedTenants = [
    ...parseList(process.env.FEISHU_ALLOWED_TENANT_KEYS),
    ...parseList(process.env.FEISHU_ALLOWED_TENANT_KEY),
  ];
  if (allowedTenants.includes(tenantKey)) return;

  const accessMode = process.env.FEISHU_TENANT_ACCESS_MODE || "allowlist";
  if (accessMode === "open" && isBeforeOpenAccessDeadline()) return;

  throw new Error("活动开放注册已结束，该飞书企业未被授权使用此应用");
}
