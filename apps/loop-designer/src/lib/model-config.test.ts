import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { allowLocalModelFallback, getConfiguredModelCandidates, hasConfiguredModel } from "./model-config";

describe("model config", () => {
  it("uses DeepSeek before Step by default", () => {
    const candidates = getConfiguredModelCandidates({
      DEEPSEEK_MODEL_API_KEY: "deepseek-key",
      STEP_MODEL_API_KEY: "step-key",
      MODEL_TIMEOUT_MS: "120000",
    });

    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].id, "deepseek");
    assert.equal(candidates[0].model, "deepseek-v4-pro");
    assert.equal(candidates[0].endpoint, "https://api.deepseek.com/chat/completions");
    assert.equal(candidates[0].reasoningEffort, "high");
    assert.equal(candidates[0].timeoutMs, 120000);
    assert.equal(candidates[1].id, "step");
    assert.equal(candidates[1].model, "step-3.7-flash");
    assert.equal(candidates[1].endpoint, "https://api.stepfun.com/step_plan/v1/chat/completions");
  });

  it("honors explicit fallback order", () => {
    const candidates = getConfiguredModelCandidates({
      MODEL_FALLBACK_ORDER: "step,deepseek",
      DEEPSEEK_MODEL_API_KEY: "deepseek-key",
      STEP_MODEL_API_KEY: "step-key",
    });

    assert.deepEqual(candidates.map((candidate) => candidate.id), ["step", "deepseek"]);
  });

  it("keeps legacy MODEL_* as an explicit fallback", () => {
    const candidates = getConfiguredModelCandidates({
      MODEL_FALLBACK_ORDER: "legacy",
      MODEL_API_URL: "https://example.com/v1/chat/completions",
      MODEL_API_KEY: "legacy-key",
      MODEL_NAME: "step-router-v1",
    });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].id, "legacy");
    assert.equal(candidates[0].model, "step-router-v1");
  });

  it("does not report configured when keys are missing", () => {
    assert.equal(hasConfiguredModel({}), false);
    assert.deepEqual(getConfiguredModelCandidates({}), []);
  });

  it("allows fallback by default only outside production", () => {
    assert.equal(allowLocalModelFallback({ NODE_ENV: "development" }), true);
    assert.equal(allowLocalModelFallback({ NODE_ENV: "production" }), false);
    assert.equal(allowLocalModelFallback({ NODE_ENV: "production", MODEL_FALLBACK_ENABLED: "true" }), true);
  });
});
