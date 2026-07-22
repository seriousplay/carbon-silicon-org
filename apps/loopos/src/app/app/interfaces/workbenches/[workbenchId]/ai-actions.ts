"use server";

import { prisma } from "@/lib/db";
import { proposeWorkflowDraft, type AIProposalResult } from "@/lib/interface-workbench/ai-proposal";
import { runWithAIProposalLocks } from "@/lib/interface-workbench/ai-proposal-action";
import { requireOrgAdmin } from "@/lib/interface-workbench/admin";

const AI_LOCK_NAMESPACE = 1_279_876_243;
const AI_TRANSACTION_MAX_WAIT_MS = 3_000;
const AI_TRANSACTION_TIMEOUT_MS = 30_000;

export async function proposeWorkflowAction(workbenchId: string, formData: FormData): Promise<AIProposalResult> {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return { ok: false, error: "INVALID_INPUT" };
  const exists = await prisma.interfaceWorkbench.findFirst({
    where: { id: workbenchId, organizationId: guard.context.organizationId },
    select: { id: true },
  });
  if (!exists) return { ok: false, error: "INVALID_INPUT" };
  const instruction = formData.get("instruction");
  const rawDefinition = formData.get("definition");
  if (typeof rawDefinition !== "string") return { ok: false, error: "INVALID_INPUT" };
  try {
    const currentDefinition: unknown = JSON.parse(rawDefinition);
    return await prisma.$transaction(async (tx) => runWithAIProposalLocks({
      userId: guard.context.userId,
      organizationId: guard.context.organizationId,
      tryLock: async (key) => {
        const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(${AI_LOCK_NAMESPACE}, hashtext(${key})) AS locked`;
        return rows[0]?.locked === true;
      },
      propose: () => proposeWorkflowDraft({ instruction, currentDefinition }),
    }), { maxWait: AI_TRANSACTION_MAX_WAIT_MS, timeout: AI_TRANSACTION_TIMEOUT_MS });
  } catch {
    return { ok: false, error: "BUSY" };
  }
}
