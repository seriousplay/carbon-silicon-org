import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, beforeEach, describe, test } from "node:test";

import * as provider from "./provider";

const originalFetch = globalThis.fetch;
const envNames = [
  "AI_PROVIDER",
  "AI_MODEL",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "STEPFUN_API_KEY",
  "STEPFUN_BASE_URL",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_THINKING",
  "DEEPSEEK_REASONING_EFFORT",
] as const;
const originalEnv = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);

function clearProviderEnv(): void {
  for (const name of envNames) delete process.env[name];
}

beforeEach(() => {
  clearProviderEnv();
  globalThis.fetch = originalFetch;
});

after(() => {
  for (const name of envNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  globalThis.fetch = originalFetch;
});

describe("AI provider selection compatibility", () => {
  test("availability requires only the selected provider's key", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.ANTHROPIC_API_KEY = "anthropic-test";
    process.env.STEPFUN_API_KEY = "stepfun-test";
    assert.equal(provider.isAIAvailable(), false);
    process.env.OPENAI_API_KEY = "openai-test";
    assert.equal(provider.isAIAvailable(), true);

    process.env.AI_PROVIDER = "anthropic";
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal(provider.isAIAvailable(), false);
    process.env.ANTHROPIC_API_KEY = "anthropic-test";
    assert.equal(provider.isAIAvailable(), true);

    process.env.AI_PROVIDER = "stepfun";
    delete process.env.STEPFUN_API_KEY;
    assert.equal(provider.isAIAvailable(), false);
    process.env.STEPFUN_API_KEY = "stepfun-test";
    assert.equal(provider.isAIAvailable(), true);

    process.env.AI_PROVIDER = "deepseek";
    delete process.env.DEEPSEEK_API_KEY;
    assert.equal(provider.isAIAvailable(), false);
    process.env.DEEPSEEK_API_KEY = "deepseek-test";
    assert.equal(provider.isAIAvailable(), true);
  });

  test("the existing default remains OpenAI", () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-test";
    assert.equal(provider.getProvider(), "openai");
    assert.equal(provider.isAIAvailable(), false);
    process.env.OPENAI_API_KEY = "openai-test";
    assert.equal(provider.isAIAvailable(), true);
  });
});

describe("AI provider request bounds", () => {
  test("uses AI SDK total timeout while preserving omitted retry and timeout defaults", () => {
    const source = readFileSync(new URL("./provider.ts", import.meta.url), "utf8");
    assert.match(source, /if \(maxRetries !== undefined\) requestOptions\.maxRetries = maxRetries/);
    assert.match(source, /if \(timeoutMs !== undefined\) requestOptions\.timeout = \{ totalMs: timeoutMs \}/);
    assert.match(source, /generateText\(\{[\s\S]*\.\.\.requestOptions,[\s\S]*\}\)/);
    assert.doesNotMatch(source, /const maxRetries = options\?\.maxRetries \?\?/);
    assert.doesNotMatch(source, /const timeoutMs = options\?\.timeoutMs \?\?/);
  });

  test("passes one total AbortSignal to StepFun and honors explicit retries", async () => {
    process.env.AI_PROVIDER = "stepfun";
    process.env.STEPFUN_API_KEY = "stepfun-test";
    process.env.STEPFUN_BASE_URL = "https://stepfun.invalid/v1";
    const signals: Array<AbortSignal | undefined> = [];
    let attempts = 0;
    globalThis.fetch = (async (_input, init) => {
      attempts += 1;
      signals.push(init?.signal ?? undefined);
      if (attempts === 1) {
        return {
          ok: false,
          status: 503,
          text: async () => "temporary",
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "stepfun-ok" } }] }),
      } as Response;
    }) as typeof fetch;

    const result = await provider.askAI("system", "prompt", {
      timeoutMs: 200,
      maxRetries: 1,
    });
    assert.equal(result, "stepfun-ok");
    assert.equal(attempts, 2);
    assert.ok(signals[0] instanceof AbortSignal);
    assert.equal(signals[0], signals[1]);
  });

  test("calls DeepSeek V4 Pro through the OpenAI-compatible API with thinking disabled by default", async () => {
    process.env.AI_PROVIDER = "deepseek";
    process.env.DEEPSEEK_API_KEY = "deepseek-test";
    process.env.DEEPSEEK_BASE_URL = "https://deepseek.invalid";
    let requestBody: Record<string, unknown> | undefined;
    let requestUrl = "";
    globalThis.fetch = (async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "deepseek-ok" } }] }),
      } as Response;
    }) as typeof fetch;

    const result = await provider.askAI("system", "prompt", {
      temperature: 0,
      maxTokens: 4000,
      timeoutMs: 45000,
      maxRetries: 0,
    });

    assert.equal(result, "deepseek-ok");
    assert.equal(requestUrl, "https://deepseek.invalid/chat/completions");
    assert.equal(requestBody?.model, "deepseek-v4-pro");
    assert.deepEqual(requestBody?.thinking, { type: "disabled" });
    assert.equal(requestBody?.temperature, 0);
    assert.equal(requestBody?.max_tokens, 4000);
    assert.equal(Object.hasOwn(requestBody!, "reasoning_effort"), false);
  });

  test("uses explicit organization provider config without reading environment keys", async () => {
    let authHeader = "";
    let requestBody: Record<string, unknown> | undefined;
    globalThis.fetch = (async (_input, init) => {
      authHeader = String((init?.headers as Record<string, string>).Authorization);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "org-config-ok" } }] }),
      } as Response;
    }) as typeof fetch;

    const result = await provider.askAIWithConfig(
      "system",
      "prompt",
      {
        provider: "deepseek",
        apiKey: "org-deepseek-key",
        model: "deepseek-v4-pro",
        baseURL: "https://org-deepseek.invalid",
        thinking: "disabled",
      },
      { maxTokens: 1200, maxRetries: 0 },
    );

    assert.equal(result, "org-config-ok");
    assert.equal(authHeader, "Bearer org-deepseek-key");
    assert.equal(requestBody?.model, "deepseek-v4-pro");
    assert.equal(requestBody?.max_tokens, 1200);
  });

  test("can enable DeepSeek thinking mode with explicit reasoning effort", async () => {
    process.env.AI_PROVIDER = "deepseek";
    process.env.DEEPSEEK_API_KEY = "deepseek-test";
    process.env.DEEPSEEK_THINKING = "enabled";
    process.env.DEEPSEEK_REASONING_EFFORT = "high";
    let requestBody: Record<string, unknown> | undefined;
    globalThis.fetch = (async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "deepseek-thinking-ok" } }] }),
      } as Response;
    }) as typeof fetch;

    const result = await provider.askAI("system", "prompt", {
      temperature: 0,
      maxTokens: 4000,
      timeoutMs: 45000,
      maxRetries: 0,
    });

    assert.equal(result, "deepseek-thinking-ok");
    assert.deepEqual(requestBody?.thinking, { type: "enabled" });
    assert.equal(requestBody?.reasoning_effort, "high");
    assert.equal(Object.hasOwn(requestBody!, "temperature"), false);
  });

  test("aborts StepFun timeout without retrying or making a live call", async () => {
    process.env.AI_PROVIDER = "stepfun";
    process.env.STEPFUN_API_KEY = "stepfun-test";
    let attempts = 0;
    globalThis.fetch = ((_input, init) => {
      attempts += 1;
      const signal = init?.signal;
      assert.ok(signal instanceof AbortSignal);
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
    }) as typeof fetch;

    const keepAlive = setTimeout(() => undefined, 50);
    try {
      await assert.rejects(
        provider.askAI("system", "prompt", { timeoutMs: 5, maxRetries: 3 }),
        (error) => error instanceof Error && error.name === "TimeoutError",
      );
    } finally {
      clearTimeout(keepAlive);
    }
    assert.equal(attempts, 1);
  });
});
