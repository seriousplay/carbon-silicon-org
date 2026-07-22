import type { AIProposalResult } from "./ai-proposal";

export async function runWithAIProposalLocks(input: {
  userId: string;
  organizationId: string;
  tryLock: (key: string) => Promise<boolean>;
  propose: () => Promise<AIProposalResult>;
}): Promise<AIProposalResult> {
  if (!await input.tryLock(`user:${input.userId}`)) return { ok: false, error: "BUSY" };
  if (!await input.tryLock(`organization:${input.organizationId}`)) return { ok: false, error: "BUSY" };
  return input.propose();
}
