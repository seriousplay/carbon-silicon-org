ALTER TABLE "organization_brain_profiles"
  ADD COLUMN "modelProvider" TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN "modelName" TEXT,
  ADD COLUMN "modelBaseUrl" TEXT,
  ADD COLUMN "modelThinkingMode" TEXT NOT NULL DEFAULT 'disabled',
  ADD COLUMN "modelApiKeyCiphertext" TEXT,
  ADD COLUMN "modelApiKeyUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "modelConfiguredById" TEXT;
