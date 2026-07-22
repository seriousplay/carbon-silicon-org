import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { AIProvider, AIProviderConfig } from "./provider";

export type OrganizationModelProvider = "system" | AIProvider;
export type ModelThinkingMode = "enabled" | "disabled";

export type OrganizationModelSettingsSummary = Readonly<{
  provider: OrganizationModelProvider;
  modelName: string;
  baseUrl: string;
  thinkingMode: ModelThinkingMode;
  hasApiKey: boolean;
  apiKeyUpdatedAt: string | null;
  inheritedProvider: AIProvider;
  inheritedModelName: string;
}>;

export type SaveOrganizationModelSettingsInput = Readonly<{
  organizationId: string;
  configuredById: string;
  provider: OrganizationModelProvider;
  modelName: string;
  baseUrl: string;
  thinkingMode: ModelThinkingMode;
  apiKey?: string;
}>;

const PROVIDERS = new Set<OrganizationModelProvider>([
  "system",
  "openai",
  "anthropic",
  "stepfun",
  "deepseek",
]);

const DEFAULTS: Record<AIProvider, { modelName: string; baseUrl: string; thinkingMode: ModelThinkingMode }> = {
  openai: { modelName: "gpt-4o-mini", baseUrl: "", thinkingMode: "disabled" },
  anthropic: { modelName: "claude-sonnet-4-20250514", baseUrl: "", thinkingMode: "disabled" },
  stepfun: {
    modelName: "step-3.7-flash",
    baseUrl: "https://api.stepfun.com/step_plan/v1",
    thinkingMode: "disabled",
  },
  deepseek: {
    modelName: "deepseek-v4-pro",
    baseUrl: "https://api.deepseek.com",
    thinkingMode: "disabled",
  },
};

function envProvider(): AIProvider {
  const value = process.env.AI_PROVIDER;
  return value === "anthropic" || value === "stepfun" || value === "deepseek"
    ? value
    : "openai";
}

function envModelName(provider: AIProvider): string {
  return process.env.AI_MODEL || DEFAULTS[provider].modelName;
}

function encryptionSecret(): string {
  const secret = process.env.MODEL_API_KEY_ENCRYPTION_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("MODEL_API_KEY_ENCRYPTION_SECRET or AUTH_SECRET is required");
  return secret;
}

function key(): Buffer {
  return createHash("sha256").update(encryptionSecret()).digest();
}

export function encryptModelApiKey(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptModelApiKey(value: string): string {
  const [version, iv, tag, encrypted] = value.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Invalid encrypted model API key");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function normalizeModelProvider(value: unknown): OrganizationModelProvider | null {
  return typeof value === "string" && PROVIDERS.has(value as OrganizationModelProvider)
    ? (value as OrganizationModelProvider)
    : null;
}

export function normalizeThinkingMode(value: unknown): ModelThinkingMode {
  return value === "enabled" ? "enabled" : "disabled";
}

function bounded(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export async function getOrganizationModelSettingsSummary(
  organizationId: string,
): Promise<OrganizationModelSettingsSummary> {
  const inheritedProvider = envProvider();
  const profile = await prisma.organizationBrainProfile.findUnique({
    where: { organizationId },
    select: {
      modelProvider: true,
      modelName: true,
      modelBaseUrl: true,
      modelThinkingMode: true,
      modelApiKeyCiphertext: true,
      modelApiKeyUpdatedAt: true,
    },
  });
  const provider = normalizeModelProvider(profile?.modelProvider) ?? "system";
  const effectiveProvider = provider === "system" ? inheritedProvider : provider;

  return {
    provider,
    modelName: profile?.modelName || envModelName(effectiveProvider),
    baseUrl: profile?.modelBaseUrl || DEFAULTS[effectiveProvider].baseUrl,
    thinkingMode: normalizeThinkingMode(profile?.modelThinkingMode),
    hasApiKey: !!profile?.modelApiKeyCiphertext,
    apiKeyUpdatedAt: profile?.modelApiKeyUpdatedAt?.toISOString() ?? null,
    inheritedProvider,
    inheritedModelName: envModelName(inheritedProvider),
  };
}

export async function saveOrganizationModelSettings(
  input: SaveOrganizationModelSettingsInput,
): Promise<void> {
  const provider = normalizeModelProvider(input.provider);
  if (!provider) throw new Error("不支持的模型服务商");

  const modelName = bounded(input.modelName, 120) || (provider === "system"
    ? envModelName(envProvider())
    : DEFAULTS[provider].modelName);
  const baseUrl = bounded(input.baseUrl, 240) || (provider === "system"
    ? DEFAULTS[envProvider()].baseUrl
    : DEFAULTS[provider].baseUrl);
  const thinkingMode = normalizeThinkingMode(input.thinkingMode);
  const trimmedKey = input.apiKey?.trim();

  const existing = await prisma.organizationBrainProfile.findUnique({
    where: { organizationId: input.organizationId },
    select: { modelApiKeyCiphertext: true },
  });

  if (provider !== "system" && !trimmedKey && !existing?.modelApiKeyCiphertext) {
    throw new Error("首次启用组织级模型配置时需要填写 API key");
  }

  const encryptedKey = trimmedKey ? encryptModelApiKey(trimmedKey) : undefined;
  const updateData = {
    modelProvider: provider,
    modelName,
    modelBaseUrl: baseUrl,
    modelThinkingMode: thinkingMode,
    modelConfiguredById: input.configuredById,
    ...(encryptedKey
      ? {
          modelApiKeyCiphertext: encryptedKey,
          modelApiKeyUpdatedAt: new Date(),
        }
      : {}),
  } satisfies Prisma.OrganizationBrainProfileUncheckedUpdateInput;
  const createData = {
    organizationId: input.organizationId,
    name: "组织大脑",
    ...updateData,
  } satisfies Prisma.OrganizationBrainProfileUncheckedCreateInput;

  await prisma.organizationBrainProfile.upsert({
    where: { organizationId: input.organizationId },
    create: createData,
    update: updateData,
  });
}

export async function resolveOrganizationAIConfig(
  organizationId: string,
): Promise<AIProviderConfig | null> {
  const profile = await prisma.organizationBrainProfile.findUnique({
    where: { organizationId },
    select: {
      modelProvider: true,
      modelName: true,
      modelBaseUrl: true,
      modelThinkingMode: true,
      modelApiKeyCiphertext: true,
    },
  });
  const provider = normalizeModelProvider(profile?.modelProvider);
  if (!provider || provider === "system") return null;
  return {
    provider,
    apiKey: profile?.modelApiKeyCiphertext
      ? decryptModelApiKey(profile.modelApiKeyCiphertext)
      : null,
    model: profile?.modelName || DEFAULTS[provider].modelName,
    baseURL: profile?.modelBaseUrl || DEFAULTS[provider].baseUrl,
    thinking: normalizeThinkingMode(profile?.modelThinkingMode),
    reasoningEffort: "high",
  };
}
