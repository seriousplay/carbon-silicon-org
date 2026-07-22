import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

type SettingsModule = typeof import("./organization-model-settings");

const require = createRequire(import.meta.url);
const originalNodePath = process.env.NODE_PATH;
const originalAuthSecret = process.env.AUTH_SECRET;
const originalEncryptionSecret = process.env.MODEL_API_KEY_ENCRYPTION_SECRET;
const compiledModules = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../node_modules/next/dist/compiled",
);
const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let settingsModule: SettingsModule;

before(async () => {
  process.env.NODE_PATH = originalNodePath
    ? `${compiledModules}:${originalNodePath}`
    : compiledModules;
  moduleWithInitPaths._initPaths();
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  process.env.AUTH_SECRET = "organization-model-settings-test-secret";
  delete process.env.MODEL_API_KEY_ENCRYPTION_SECRET;
  settingsModule = await import("./organization-model-settings");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = originalNodePath;
  if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = originalAuthSecret;
  if (originalEncryptionSecret === undefined) delete process.env.MODEL_API_KEY_ENCRYPTION_SECRET;
  else process.env.MODEL_API_KEY_ENCRYPTION_SECRET = originalEncryptionSecret;
  moduleWithInitPaths._initPaths();
});

test("encryptModelApiKey never stores plaintext and decrypts with the server secret", () => {
  const plaintext = "sk-test-organization-secret";
  const encrypted = settingsModule.encryptModelApiKey(plaintext);

  assert.notEqual(encrypted, plaintext);
  assert.equal(encrypted.includes(plaintext), false);
  assert.equal(settingsModule.decryptModelApiKey(encrypted), plaintext);
});

test("normalizes supported model settings and rejects unknown providers", () => {
  assert.equal(settingsModule.normalizeModelProvider("deepseek"), "deepseek");
  assert.equal(settingsModule.normalizeModelProvider("system"), "system");
  assert.equal(settingsModule.normalizeModelProvider("unknown"), null);
  assert.equal(settingsModule.normalizeThinkingMode("enabled"), "enabled");
  assert.equal(settingsModule.normalizeThinkingMode("anything-else"), "disabled");
});
