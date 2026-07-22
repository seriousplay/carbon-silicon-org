"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { requirePilotInterfacePermission } from "@/lib/permissions";

const WORKBENCH_PATH = "/app/interfaces/data-pretraining";
const SLA_MS = 24 * 60 * 60 * 1000;

function text(formData: FormData, key: string): string {
  return ((formData.get(key) as string | null) ?? "").trim();
}

function optionalText(formData: FormData, key: string): string | null {
  return text(formData, key) || null;
}

function parseRequiredRate(formData: FormData): number {
  const raw = text(formData, "abnormalSampleRate");
  if (!raw) {
    throw new Error("请填写异常样本率");
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error("异常样本率必须是数字");
  }
  if (value < 0) {
    throw new Error("异常样本率不能为负数");
  }
  return value;
}

async function requireScopedRun(runId: string, orgId: string) {
  const run = await prisma.interfaceValidationRun.findFirst({
    where: { id: runId, organizationId: orgId },
    include: {
      interface: {
        include: {
          fromCircle: { select: { id: true, name: true } },
          toCircle: { select: { id: true, name: true } },
        },
      },
      createdTension: { select: { id: true } },
    },
  });

  if (!run) {
    throw new Error("验证记录不存在");
  }

  return run;
}

type OverdueNotificationRun = {
  id: string;
  dataVersion: string;
  interface: {
    name: string;
    ownerId: string;
    fromCircle: {
      name: string;
      leadPersonId: string | null;
    };
    toCircle: {
      name: string;
      leadPersonId: string | null;
    };
  };
};

async function requireOverdueNotificationOwners(run: OverdueNotificationRun, orgId: string) {
  const dataOwnerId = run.interface.fromCircle.leadPersonId ?? run.interface.ownerId;
  const pretrainingOwnerId = run.interface.toCircle.leadPersonId;
  const missingOwners: string[] = [];

  if (!dataOwnerId) missingOwners.push(`${run.interface.fromCircle.name} owner`);
  if (!pretrainingOwnerId) missingOwners.push(`${run.interface.toCircle.name} owner`);

  if (!dataOwnerId || !pretrainingOwnerId) {
    throw new Error(
      `实现阻塞：无法识别逾期通知接收人（${missingOwners.join("、")}）。请先在当前组织模型中配置 Data 和 Pretraining 两侧负责人。`
    );
  }

  const ownerIds = Array.from(new Set([dataOwnerId, pretrainingOwnerId]));
  const scopedOwners = await prisma.person.findMany({
    where: { id: { in: ownerIds }, organizationId: orgId },
    select: { id: true },
  });

  if (scopedOwners.length !== ownerIds.length) {
    throw new Error("实现阻塞：逾期通知接收人不属于当前组织，不能发送跨组织通知。");
  }

  return { dataOwnerId, pretrainingOwnerId };
}

async function notifyOverdueValidationRun(run: OverdueNotificationRun, orgId: string) {
  const { dataOwnerId, pretrainingOwnerId } = await requireOverdueNotificationOwners(run, orgId);
  const targetUrl = `${WORKBENCH_PATH}?run=${run.id}`;
  const body = `数据版本 ${run.dataVersion} 的 ${run.interface.name} 烟测超过 24h 未完成，请 Data 和 Pretraining 两侧协同处理。`;

  await createNotification({
    organizationId: orgId,
    recipientId: dataOwnerId,
    type: "interface_validation_overdue",
    eventKey: `interface-validation:${run.id}:overdue`,
    title: `Data 验证逾期：${run.dataVersion}`,
    body,
    targetUrl,
  });

  await createNotification({
    organizationId: orgId,
    recipientId: pretrainingOwnerId,
    type: "interface_validation_overdue",
    eventKey: `interface-validation:${run.id}:overdue`,
    title: `Pretraining 验证逾期：${run.dataVersion}`,
    body,
    targetUrl,
  });
}

export async function submitValidationAction(formData: FormData): Promise<void> {
  const orgId = await getCurrentOrgId();
  const interfaceId = text(formData, "interfaceId");
  const runId = optionalText(formData, "runId");
  const dataVersion = text(formData, "dataVersion");
  const dataLocation = text(formData, "dataLocation");
  const changeSummary = text(formData, "changeSummary");
  const dataScopeScale = text(formData, "dataScopeScale");

  if (!interfaceId || !dataVersion || !dataLocation || !changeSummary || !dataScopeScale) {
    throw new Error("请填写数据版本、位置、变更摘要和范围量级");
  }

  const intf = await prisma.circleInterface.findFirst({
    where: { id: interfaceId, organizationId: orgId, status: { not: "ARCHIVED" } },
    select: { id: true },
  });
  if (!intf) {
    throw new Error("接口不存在");
  }
  await requirePilotInterfacePermission(interfaceId, orgId, "submit-validation");

  const data = {
    dataVersion,
    dataLocation,
    changeSummary,
    dataScopeScale,
    knownRisks: optionalText(formData, "knownRisks"),
    suggestedSmokeRunConfig: optionalText(formData, "suggestedSmokeRunConfig"),
    submittedAt: new Date(),
    status: "AWAITING_SMOKE_RUN" as const,
  };

  let run;
  if (runId) {
    const existing = await requireScopedRun(runId, orgId);
    if (existing.interfaceId !== interfaceId || existing.status !== "TO_SUBMIT") {
      throw new Error("只有待提交草稿可以提交验证");
    }
    run = await prisma.interfaceValidationRun.update({
      where: { id: existing.id },
      data,
    });
  } else {
    run = await prisma.interfaceValidationRun.create({
      data: {
        organizationId: orgId,
        interfaceId,
        ...data,
      },
    });
  }

  revalidatePath(WORKBENCH_PATH);
  redirect(`${WORKBENCH_PATH}?run=${run.id}`);
}

export async function recordSmokeRunResultAction(
  runId: string,
  formData: FormData
): Promise<void> {
  const orgId = await getCurrentOrgId();
  const run = await requireScopedRun(runId, orgId);
  await requirePilotInterfacePermission(run.interfaceId, orgId, "record-smoke-run");
  const result = text(formData, "smokeRunResult");
  const lossSummary = text(formData, "lossSummary");
  const throughputSummary = text(formData, "throughputSummary");
  const representativeSampleTrace = text(formData, "representativeSampleTrace");
  const trainingScheduleImpact = text(formData, "trainingScheduleImpact");

  if (!["AWAITING_SMOKE_RUN", "OVERDUE"].includes(run.status)) {
    throw new Error("只有等待烟测或已逾期的记录可以录入烟测结果");
  }
  if (result !== "PASS" && result !== "FAIL") {
    throw new Error("请选择烟测结果");
  }
  if (!lossSummary || !throughputSummary || !representativeSampleTrace || !trainingScheduleImpact) {
    throw new Error("请补全烟测证据");
  }
  const abnormalSampleRate = parseRequiredRate(formData);

  await prisma.interfaceValidationRun.update({
    where: { id: run.id },
    data: {
      smokeRunResult: result,
      lossSummary,
      throughputSummary,
      abnormalSampleRate,
      representativeSampleTrace,
      trainingScheduleImpact,
      status: result === "PASS" ? "PASSED" : "FAILED",
    },
  });

  revalidatePath(WORKBENCH_PATH);
  redirect(`${WORKBENCH_PATH}?run=${run.id}`);
}

export async function closePassingValidationAction(runId: string): Promise<void> {
  const orgId = await getCurrentOrgId();
  const run = await requireScopedRun(runId, orgId);

  if (run.status !== "PASSED" || run.smokeRunResult !== "PASS") {
    throw new Error("只有已通过的验证可以关闭");
  }

  const smokeRecordedAt = run.updatedAt;
  const slaResult =
    run.submittedAt && smokeRecordedAt.getTime() - run.submittedAt.getTime() <= SLA_MS
      ? "ACHIEVED"
      : "MISSED";

  await prisma.interfaceValidationRun.update({
    where: { id: run.id },
    data: {
      slaResult,
      closedAt: new Date(),
      status: "PASSED",
    },
  });

  revalidatePath(WORKBENCH_PATH);
  redirect(`${WORKBENCH_PATH}?run=${run.id}`);
}

export async function createFailureTensionDraftAction(
  runId: string,
  formData: FormData
): Promise<void> {
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  const run = await requireScopedRun(runId, orgId);

  if (!person) {
    throw new Error("无法获取当前用户");
  }
  await requirePilotInterfacePermission(run.interfaceId, orgId, "create-failure-tension");
  if (run.status !== "FAILED") {
    throw new Error("只有失败验证可以生成张力草稿");
  }
  if (run.createdTensionId) {
    redirect(`${WORKBENCH_PATH}?run=${run.id}`);
  }

  const title = text(formData, "title") || `数据验证失败：${run.dataVersion}`;
  const description =
    text(formData, "description") ||
    [
      `数据版本：${run.dataVersion}`,
      `接口：${run.interface.fromCircle.name} -> ${run.interface.toCircle.name}`,
      `Loss：${run.lossSummary ?? "未填写"}`,
      `Throughput：${run.throughputSummary ?? "未填写"}`,
      `异常样本率：${run.abnormalSampleRate ?? "未填写"}`,
      `代表样本：${run.representativeSampleTrace ?? "未填写"}`,
      `训练排期影响：${run.trainingScheduleImpact ?? "未填写"}`,
    ].join("\n");

  const tension = await prisma.tension.create({
    data: {
      organizationId: orgId,
      title,
      description,
      type: "PROBLEMATIC",
      source: "FORM",
      conflictLevel: "L2",
      raiserId: person.id,
      interfaceDependencyId: run.interfaceId,
      circles: {
        connect: [
          { id: run.interface.fromCircle.id },
          { id: run.interface.toCircle.id },
        ],
      },
    },
  });

  await prisma.interfaceValidationRun.update({
    where: { id: run.id },
    data: { createdTensionId: tension.id },
  });

  revalidatePath(WORKBENCH_PATH);
  revalidatePath("/app/tensions");
  redirect(`${WORKBENCH_PATH}?run=${run.id}`);
}

export async function updateOverdueValidationRunsAction(
  formData: FormData
): Promise<void> {
  const orgId = await getCurrentOrgId();
  const interfaceId = optionalText(formData, "interfaceId");
  const cutoff = new Date(Date.now() - SLA_MS);

  if (interfaceId) {
    const intf = await prisma.circleInterface.findFirst({
      where: { id: interfaceId, organizationId: orgId },
      select: { id: true },
    });
    if (!intf) {
      throw new Error("接口不存在");
    }
  }

  const overdueRuns = await prisma.interfaceValidationRun.findMany({
    where: {
      organizationId: orgId,
      interfaceId: interfaceId ?? undefined,
      status: "AWAITING_SMOKE_RUN",
      submittedAt: { lt: cutoff },
    },
    select: {
      id: true,
      dataVersion: true,
      interface: {
        select: {
          name: true,
          ownerId: true,
          fromCircle: { select: { name: true, leadPersonId: true } },
          toCircle: { select: { name: true, leadPersonId: true } },
        },
      },
    },
  });

  if (overdueRuns.length === 0) {
    revalidatePath(WORKBENCH_PATH);
    return;
  }

  for (const run of overdueRuns) {
    await requireOverdueNotificationOwners(run, orgId);
  }

  const updatedRuns = await prisma.$transaction(
    overdueRuns.map((run) =>
      prisma.interfaceValidationRun.updateMany({
        where: {
          id: run.id,
          organizationId: orgId,
          status: "AWAITING_SMOKE_RUN",
        },
        data: { status: "OVERDUE" },
      })
    )
  );

  for (let index = 0; index < overdueRuns.length; index += 1) {
    if (updatedRuns[index].count === 1) {
      await notifyOverdueValidationRun(overdueRuns[index], orgId);
    }
  }

  revalidatePath(WORKBENCH_PATH);
}
