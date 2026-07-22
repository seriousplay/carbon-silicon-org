export type ModelProviderId = "deepseek" | "step" | "legacy";

export type ModelCandidate = {
  id: ModelProviderId;
  label: string;
  endpoint: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  reasoningEffort?: "low" | "medium" | "high";
  thinking?: boolean;
};

type EnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>;

const DEFAULT_TIMEOUT_MS = 300000;
const DEFAULT_ORDER: ModelProviderId[] = ["deepseek", "step", "legacy"];

function clean(value: string | undefined) {
  return value?.trim() || undefined;
}

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeReasoningEffort(value: string | undefined, fallback?: "low" | "medium" | "high") {
  if (value === "low" || value === "medium" || value === "high") return value;
  return fallback;
}

function normalizeChatEndpoint(baseUrl: string | undefined, apiUrl: string | undefined, defaultBaseUrl: string) {
  const configuredUrl = clean(apiUrl)?.replace(/\/$/, "");
  if (configuredUrl) return configuredUrl;
  const base = (clean(baseUrl) || defaultBaseUrl).replace(/\/$/, "");
  const apiRoot = base.endsWith("/v1") ? base : `${base}/v1`;
  return `${apiRoot}/chat/completions`;
}

function normalizeDeepSeekEndpoint(baseUrl: string | undefined, apiUrl: string | undefined) {
  const configuredUrl = clean(apiUrl)?.replace(/\/$/, "");
  if (configuredUrl) return configuredUrl;
  const base = (clean(baseUrl) || "https://api.deepseek.com").replace(/\/$/, "");
  return `${base}/chat/completions`;
}

function parseProviderOrder(env: EnvSource) {
  const raw = clean(env.MODEL_FALLBACK_ORDER);
  if (!raw) return DEFAULT_ORDER;
  const seen = new Set<ModelProviderId>();
  const order = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is ModelProviderId => item === "deepseek" || item === "step" || item === "legacy")
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  return order.length > 0 ? order : DEFAULT_ORDER;
}

export function getConfiguredModelCandidates(env: EnvSource = process.env): ModelCandidate[] {
  const timeoutMs = numberFromEnv(env.MODEL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const candidates: Record<ModelProviderId, ModelCandidate | undefined> = {
    deepseek: clean(env.DEEPSEEK_MODEL_API_KEY || env.DEEPSEEK_API_KEY)
      ? {
          id: "deepseek",
          label: "DeepSeek V4 Pro",
          endpoint: normalizeDeepSeekEndpoint(env.DEEPSEEK_MODEL_BASE_URL || env.DEEPSEEK_BASE_URL, env.DEEPSEEK_MODEL_API_URL),
          apiKey: clean(env.DEEPSEEK_MODEL_API_KEY || env.DEEPSEEK_API_KEY) || "",
          model: clean(env.DEEPSEEK_MODEL_NAME || env.DEEPSEEK_MODEL) || "deepseek-v4-pro",
          timeoutMs,
          reasoningEffort: normalizeReasoningEffort(env.DEEPSEEK_REASONING_EFFORT, "high"),
          thinking: env.DEEPSEEK_THINKING !== "false",
        }
      : undefined,
    step: clean(env.STEP_MODEL_API_KEY || env.STEP_API_KEY)
      ? {
          id: "step",
          label: "Step 3.7 Flash",
          endpoint: normalizeChatEndpoint(env.STEP_MODEL_BASE_URL || env.STEP_BASE_URL, env.STEP_MODEL_API_URL, "https://api.stepfun.com/step_plan"),
          apiKey: clean(env.STEP_MODEL_API_KEY || env.STEP_API_KEY) || "",
          model: clean(env.STEP_MODEL_NAME || env.STEP_MODEL) || "step-3.7-flash",
          timeoutMs,
          reasoningEffort: normalizeReasoningEffort(env.STEP_REASONING_EFFORT, "medium"),
        }
      : undefined,
    legacy: clean(env.MODEL_API_KEY) && (clean(env.MODEL_API_URL) || clean(env.MODEL_BASE_URL)) && clean(env.MODEL_NAME)
      ? {
          id: "legacy",
          label: "Legacy MODEL_*",
          endpoint: normalizeChatEndpoint(env.MODEL_BASE_URL, env.MODEL_API_URL, ""),
          apiKey: clean(env.MODEL_API_KEY) || "",
          model: clean(env.MODEL_NAME) || "",
          timeoutMs,
        }
      : undefined,
  };

  return parseProviderOrder(env)
    .map((provider) => candidates[provider])
    .filter((candidate): candidate is ModelCandidate => Boolean(candidate));
}

export function hasConfiguredModel(env: EnvSource = process.env) {
  return getConfiguredModelCandidates(env).length > 0;
}

export function allowLocalModelFallback(env: EnvSource = process.env) {
  if (env.MODEL_FALLBACK_ENABLED === "true") return true;
  if (env.MODEL_FALLBACK_ENABLED === "false") return false;
  return env.NODE_ENV !== "production";
}

export function getModelCandidateSummaries(env: EnvSource = process.env) {
  const configuredCandidates = getConfiguredModelCandidates(env);
  const configured = new Set(configuredCandidates.map((candidate) => candidate.id));
  const byId = new Map(configuredCandidates.map((candidate) => [candidate.id, candidate]));
  const expected: Record<ModelProviderId, { label: string; model: string; endpoint: string }> = {
    deepseek: {
      label: "DeepSeek V4 Pro",
      model: clean(env.DEEPSEEK_MODEL_NAME || env.DEEPSEEK_MODEL) || "deepseek-v4-pro",
      endpoint: normalizeDeepSeekEndpoint(env.DEEPSEEK_MODEL_BASE_URL || env.DEEPSEEK_BASE_URL, env.DEEPSEEK_MODEL_API_URL),
    },
    step: {
      label: "Step 3.7 Flash",
      model: clean(env.STEP_MODEL_NAME || env.STEP_MODEL) || "step-3.7-flash",
      endpoint: normalizeChatEndpoint(env.STEP_MODEL_BASE_URL || env.STEP_BASE_URL, env.STEP_MODEL_API_URL, "https://api.stepfun.com/step_plan"),
    },
    legacy: {
      label: "Legacy MODEL_*",
      model: clean(env.MODEL_NAME) || "",
      endpoint: clean(env.MODEL_API_URL) || clean(env.MODEL_BASE_URL)
        ? normalizeChatEndpoint(env.MODEL_BASE_URL, env.MODEL_API_URL, "")
        : "",
    },
  };
  return (["deepseek", "step", "legacy"] as ModelProviderId[]).map((id) => {
    const candidate = byId.get(id);
    return {
      id,
      configured: configured.has(id),
      label: candidate?.label || expected[id].label,
      model: candidate?.model || expected[id].model || null,
      endpoint: candidate?.endpoint || expected[id].endpoint || null,
    };
  });
}
