/**
 * AI provider 抽象层
 *
 * 基于 docs/06-AI能力边界与降级.md
 * 基于 docs/09 v1.5 决策：可切换多 provider
 *
 * 阶跃 Step Plan 用直接 fetch 调用（OpenAI 兼容接口），
 * 因为 Vercel AI SDK 对推理模型的 reasoning_content 字段解析有兼容问题。
 * OpenAI/Anthropic 仍走 AI SDK。
 */
import { generateText, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

export type AIProvider = "openai" | "anthropic" | "stepfun" | "deepseek";

export type AIProviderConfig = Readonly<{
  provider: AIProvider;
  apiKey?: string | null;
  model?: string | null;
  baseURL?: string | null;
  thinking?: "enabled" | "disabled" | null;
  reasoningEffort?: string | null;
}>;

let cachedModel: LanguageModel | null = null;

/** 获取当前配置的 LLM 模型（单例，仅 OpenAI/Anthropic 用）*/
export function getModel(): LanguageModel {
  if (cachedModel) return cachedModel;

  const provider = (process.env.AI_PROVIDER ?? "openai") as AIProvider;

  if (provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY 未配置");
    }
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    cachedModel = anthropic(process.env.AI_MODEL ?? "claude-sonnet-4-20250514");
  } else if (provider === "deepseek") {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY 未配置");
    }
    const deepseek = createOpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      name: "deepseek",
    });
    cachedModel = deepseek(process.env.AI_MODEL ?? "deepseek-v4-pro");
  } else {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY 未配置");
    }
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    cachedModel = openai(process.env.AI_MODEL ?? "gpt-4o-mini");
  }

  return cachedModel;
}

/** AI 是否可用 */
export function isAIAvailable(): boolean {
  return isAIConfigAvailable(envProviderConfig());
}

export function isAIConfigAvailable(config: AIProviderConfig): boolean {
  const provider = config.provider;
  if (provider === "openai") return !!config.apiKey;
  if (provider === "anthropic") return !!config.apiKey;
  if (provider === "stepfun") return !!config.apiKey;
  if (provider === "deepseek") return !!config.apiKey;
  return false;
}

/** 当前 provider */
export function getProvider(): AIProvider {
  return (process.env.AI_PROVIDER ?? "openai") as AIProvider;
}

function envProviderConfig(): AIProviderConfig {
  const provider = getProvider();
  if (provider === "anthropic") {
    return {
      provider,
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.AI_MODEL ?? "claude-sonnet-4-20250514",
    };
  }
  if (provider === "stepfun") {
    return {
      provider,
      apiKey: process.env.STEPFUN_API_KEY,
      model: process.env.AI_MODEL ?? "step-3.7-flash",
      baseURL: process.env.STEPFUN_BASE_URL ?? "https://api.stepfun.com/step_plan/v1",
    };
  }
  if (provider === "deepseek") {
    return {
      provider,
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.AI_MODEL ?? "deepseek-v4-pro",
      baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      thinking: process.env.DEEPSEEK_THINKING === "enabled" ? "enabled" : "disabled",
      reasoningEffort: process.env.DEEPSEEK_REASONING_EFFORT ?? "high",
    };
  }
  return {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
  };
}

/**
 * 通用 AI 调用（非流式）
 * 阶跃用直接 fetch，其他用 AI SDK
 */
export async function askAI(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    maxRetries?: number;
  }
): Promise<string> {
  return askAIWithConfig(systemPrompt, userPrompt, envProviderConfig(), options);
}

export async function askAIWithConfig(
  systemPrompt: string,
  userPrompt: string,
  config: AIProviderConfig,
  options?: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    maxRetries?: number;
  }
): Promise<string> {
  if (!isAIConfigAvailable(config)) {
    throw new Error("AI 不可用：未配置 API Key");
  }

  const provider = config.provider;
  const temperature = options?.temperature ?? 0.3;
  const maxTokens = options?.maxTokens ?? 1000;
  const timeoutMs = options?.timeoutMs;
  const maxRetries = options?.maxRetries;
  if (
    (timeoutMs !== undefined &&
      (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) ||
    (maxRetries !== undefined &&
      (!Number.isInteger(maxRetries) || maxRetries < 0))
  ) {
    throw new Error("AI 调用选项无效");
  }

  // 阶跃 Step Plan：直接 fetch（绕过 AI SDK 推理模型兼容问题）
  if (provider === "stepfun") {
    return callStepFun(
      systemPrompt,
      userPrompt,
      config,
      temperature,
      maxTokens,
      timeoutMs,
      maxRetries,
    );
  }
  if (provider === "deepseek") {
    return callDeepSeek(
      systemPrompt,
      userPrompt,
      config,
      temperature,
      maxTokens,
      timeoutMs,
      maxRetries,
    );
  }

  // OpenAI / Anthropic：用 AI SDK
  const requestOptions: {
    maxRetries?: number;
    timeout?: { totalMs: number };
  } = {};
  if (maxRetries !== undefined) requestOptions.maxRetries = maxRetries;
  if (timeoutMs !== undefined) requestOptions.timeout = { totalMs: timeoutMs };
  const model =
    provider === "anthropic"
      ? createAnthropic({ apiKey: config.apiKey ?? "" })(
          config.model ?? "claude-sonnet-4-20250514",
        )
      : createOpenAI({ apiKey: config.apiKey ?? "" })(config.model ?? "gpt-4o-mini");
  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature,
    maxOutputTokens: maxTokens,
    ...requestOptions,
  });
  return text;
}

async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  config: AIProviderConfig,
  temperature: number,
  maxTokens: number,
  timeoutMs?: number,
  configuredMaxRetries?: number,
): Promise<string> {
  const baseURL = config.baseURL ?? "https://api.deepseek.com";
  const apiKey = config.apiKey!;
  const model = config.model ?? "deepseek-v4-pro";
  const thinking = config.thinking === "enabled" ? "enabled" : "disabled";
  const signal = timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs);
  const maxRetries = configuredMaxRetries ?? 0;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        stream: false,
        thinking: { type: thinking },
      };
      if (thinking === "enabled") {
        body.reasoning_effort = config.reasoningEffort ?? "high";
      } else {
        body.temperature = temperature;
      }

      const res = await fetch(`${baseURL.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`DeepSeek API 错误 ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("DeepSeek API 返回空 content");
      return content;
    } catch (error) {
      if (signal?.aborted || attempt === maxRetries) throw error;
    }
  }
  throw new Error("DeepSeek API 调用失败");
}

/**
 * 阶跃 Step Plan 直接调用
 * OpenAI 兼容接口，但手动解析 content 字段（跳过 reasoning）
 */
async function callStepFun(
  systemPrompt: string,
  userPrompt: string,
  config: AIProviderConfig,
  temperature: number,
  maxTokens: number,
  timeoutMs?: number,
  configuredMaxRetries?: number,
): Promise<string> {
  const baseURL = config.baseURL ?? "https://api.stepfun.com/step_plan/v1";
  const apiKey = config.apiKey!;
  const model = config.model ?? "step-3.7-flash";
  const signal = timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs);
  const maxRetries = configuredMaxRetries ?? 0;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const res = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        signal,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`阶跃 API 错误 ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await res.json();
      // content 是最终答案，reasoning 是推理过程（不取）
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("阶跃 API 返回空 content");
      return content;
    } catch (error) {
      if (signal?.aborted || attempt === maxRetries) throw error;
    }
  }
  throw new Error("阶跃 API 调用失败");
}

/**
 * 通用 AI 调用（流式，仅 OpenAI/Anthropic）
 */
export async function streamAI(systemPrompt: string, userPrompt: string) {
  if (!isAIAvailable()) {
    throw new Error("AI 不可用：未配置 API Key");
  }
  const { streamText } = await import("ai");
  return streamText({
    model: getModel(),
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  });
}
