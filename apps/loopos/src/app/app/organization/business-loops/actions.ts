"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import type { BusinessLoopActivityType, BusinessLoopEdgeType } from "@/generated/prisma/enums";
import { getCurrentOrgId, getCurrentPerson, requireSession } from "@/lib/session";

export type BusinessLoopAuthoringState = { error?: string; success?: string } | undefined;

const activityTypes = new Set<BusinessLoopActivityType>(["WORK", "DECISION", "HANDOFF", "SIGNAL"]);
const edgeTypes = new Set<BusinessLoopEdgeType>(["VALUE", "DATA", "DECISION_SIGNAL", "EVIDENCE"]);

function text(formData: FormData, name: string, options: { min?: number; max?: number } = {}): string {
  const value = formData.get(name);
  const min = options.min ?? 1;
  const max = options.max ?? 240;
  if (typeof value !== "string") throw new Error("表单信息不完整。");
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new Error("请检查输入长度。");
  return trimmed;
}

function optionalText(formData: FormData, name: string, max = 500): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function optionalId(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseActivityType(value: string): BusinessLoopActivityType {
  if (!activityTypes.has(value as BusinessLoopActivityType)) throw new Error("活动类型不受支持。");
  return value as BusinessLoopActivityType;
}

function parseEdgeType(value: string): BusinessLoopEdgeType {
  if (!edgeTypes.has(value as BusinessLoopEdgeType)) throw new Error("流动类型不受支持。");
  return value as BusinessLoopEdgeType;
}

async function requireOrgAdmin(): Promise<{ organizationId: string; personId: string }> {
  const session = await requireSession();
  const organizationId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  if (!person || person.organizationId !== organizationId) throw new Error("无法确认当前组织身份。");
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId } },
    select: { role: true },
  });
  if (membership?.role !== "ORG_ADMIN") throw new Error("只有组织管理员可以编辑业务回路草稿。");
  return { organizationId, personId: person.id };
}

async function requireDraftLoop(organizationId: string, loopId: string): Promise<{ id: string; versionId: string | null }> {
  const loop = await prisma.businessLoop.findFirst({
    where: { id: loopId, organizationId, status: "DRAFT" },
    select: {
      id: true,
      versions: {
        where: { status: "DRAFT" },
        select: { id: true },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });
  if (!loop) throw new Error("只能编辑草稿状态的业务回路。");
  return { id: loop.id, versionId: loop.versions[0]?.id ?? null };
}

async function ensureCircle(organizationId: string, circleId: string | null): Promise<string | null> {
  if (!circleId) return null;
  const circle = await prisma.circle.findFirst({
    where: { id: circleId, organizationId, status: { not: "ARCHIVED" } },
    select: { id: true },
  });
  if (!circle) throw new Error("选择的组织结构不存在。");
  return circle.id;
}

async function ensureRole(organizationId: string, roleId: string | null): Promise<string | null> {
  if (!roleId) return null;
  const role = await prisma.roleDef.findFirst({
    where: { id: roleId, organizationId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!role) throw new Error("选择的角色不存在。");
  return role.id;
}

async function ensureInterface(organizationId: string, interfaceId: string | null): Promise<string | null> {
  if (!interfaceId) return null;
  const circleInterface = await prisma.circleInterface.findFirst({
    where: { id: interfaceId, organizationId, status: { not: "ARCHIVED" } },
    select: { id: true },
  });
  if (!circleInterface) throw new Error("选择的接口不存在。");
  return circleInterface.id;
}

export async function saveBusinessLoopDraftAction(
  _previous: BusinessLoopAuthoringState,
  formData: FormData,
): Promise<BusinessLoopAuthoringState> {
  try {
    const { organizationId } = await requireOrgAdmin();
    const loopId = optionalId(formData, "loopId");
    const name = text(formData, "name", { min: 2, max: 120 });
    const purpose = optionalText(formData, "purpose", 500);

    if (loopId) {
      const updated = await prisma.businessLoop.updateMany({
        where: { id: loopId, organizationId, status: "DRAFT" },
        data: { name, purpose },
      });
      if (updated.count !== 1) throw new Error("只能编辑草稿状态的业务回路。");
      revalidatePath("/app/organization/business-loops");
      return { success: "业务回路草稿已更新。" };
    }

    const existingDraft = await prisma.businessLoop.findFirst({
      where: { organizationId, status: "DRAFT", name },
      select: { id: true },
    });
    if (existingDraft) {
      await prisma.businessLoop.update({
        where: { id: existingDraft.id },
        data: { purpose },
      });
      revalidatePath("/app/organization/business-loops");
      return { success: "已有同名草稿，已更新草稿目的。" };
    }

    await prisma.$transaction(async (tx) => {
      const loop = await tx.businessLoop.create({
        data: { organizationId, name, purpose, status: "DRAFT" },
        select: { id: true },
      });
      await tx.businessLoopVersion.create({
        data: {
          organizationId,
          businessLoopId: loop.id,
          version: 1,
          status: "DRAFT",
          summary: "业务回路草稿",
        },
      });
    });
    revalidatePath("/app/organization/business-loops");
    return { success: "业务回路草稿已创建。" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "业务回路草稿保存失败。" };
  }
}

export async function addBusinessLoopActivityAction(
  _previous: BusinessLoopAuthoringState,
  formData: FormData,
): Promise<BusinessLoopAuthoringState> {
  try {
    const { organizationId } = await requireOrgAdmin();
    const loopId = text(formData, "loopId", { min: 1, max: 120 });
    const loop = await requireDraftLoop(organizationId, loopId);
    const name = text(formData, "activityName", { min: 2, max: 120 });
    const activityType = parseActivityType(text(formData, "activityType", { min: 1, max: 40 }));
    const circleId = await ensureCircle(organizationId, optionalId(formData, "circleId"));
    const ownerRoleId = await ensureRole(organizationId, optionalId(formData, "ownerRoleId"));

    const existingActivity = await prisma.businessLoopActivity.findFirst({
      where: { organizationId, businessLoopId: loop.id, name },
      select: { id: true },
    });
    if (existingActivity) {
      await prisma.businessLoopActivity.update({
        where: { id: existingActivity.id },
        data: {
          activityType,
          circleId,
          ownerRoleId,
          description: optionalText(formData, "activityDescription", 500),
        },
      });
      revalidatePath("/app/organization/business-loops");
      return { success: "已有同名活动，已更新活动信息。" };
    }

    await prisma.businessLoopActivity.create({
      data: {
        organizationId,
        businessLoopId: loop.id,
        versionId: loop.versionId,
        name,
        activityType,
        circleId,
        ownerRoleId,
        description: optionalText(formData, "activityDescription", 500),
      },
    });
    revalidatePath("/app/organization/business-loops");
    return { success: "业务活动已加入草稿。" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "业务活动保存失败。" };
  }
}

export async function addBusinessLoopEdgeAction(
  _previous: BusinessLoopAuthoringState,
  formData: FormData,
): Promise<BusinessLoopAuthoringState> {
  try {
    const { organizationId } = await requireOrgAdmin();
    const loopId = text(formData, "loopId", { min: 1, max: 120 });
    const loop = await requireDraftLoop(organizationId, loopId);
    const label = text(formData, "edgeLabel", { min: 2, max: 160 });
    const edgeType = parseEdgeType(text(formData, "edgeType", { min: 1, max: 40 }));
    const fromCircleId = await ensureCircle(organizationId, optionalId(formData, "fromCircleId"));
    const toCircleId = await ensureCircle(organizationId, optionalId(formData, "toCircleId"));
    const interfaceId = await ensureInterface(organizationId, optionalId(formData, "interfaceId"));

    const existingEdge = await prisma.businessLoopEdge.findFirst({
      where: { organizationId, businessLoopId: loop.id, label },
      select: { id: true },
    });
    if (existingEdge) {
      await prisma.businessLoopEdge.update({
        where: { id: existingEdge.id },
        data: {
          edgeType,
          fromCircleId,
          toCircleId,
          interfaceId,
          description: optionalText(formData, "edgeDescription", 500),
        },
      });
      revalidatePath("/app/organization/business-loops");
      return { success: "已有同名流动，已更新流动信息。" };
    }

    await prisma.businessLoopEdge.create({
      data: {
        organizationId,
        businessLoopId: loop.id,
        versionId: loop.versionId,
        label,
        edgeType,
        fromCircleId,
        toCircleId,
        interfaceId,
        description: optionalText(formData, "edgeDescription", 500),
      },
    });
    revalidatePath("/app/organization/business-loops");
    return { success: "价值或数据流已加入草稿。" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "价值或数据流保存失败。" };
  }
}

export async function addBusinessLoopEvidenceLabelAction(
  _previous: BusinessLoopAuthoringState,
  formData: FormData,
): Promise<BusinessLoopAuthoringState> {
  try {
    const { organizationId } = await requireOrgAdmin();
    const loopId = text(formData, "loopId", { min: 1, max: 120 });
    const loop = await requireDraftLoop(organizationId, loopId);
    const label = text(formData, "evidenceLabel", { min: 2, max: 160 });
    const targetId = `external-note:${label.slice(0, 80)}`;
    const existingEvidence = await prisma.businessLoopEvidenceRef.findFirst({
      where: { organizationId, businessLoopId: loop.id, kind: "EXTERNAL_NOTE", targetId },
      select: { id: true },
    });
    if (existingEvidence) {
      await prisma.businessLoopEvidenceRef.update({
        where: { id: existingEvidence.id },
        data: { label },
      });
      revalidatePath("/app/organization/business-loops");
      return { success: "已有同名证据标签，已更新标签。" };
    }
    await prisma.businessLoopEvidenceRef.create({
      data: {
        organizationId,
        businessLoopId: loop.id,
        versionId: loop.versionId,
        kind: "EXTERNAL_NOTE",
        targetId,
        label,
      },
    });
    revalidatePath("/app/organization/business-loops");
    return { success: "证据标签已加入草稿。" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "证据标签保存失败。" };
  }
}

export async function publishBusinessLoopDraftAction(
  _previous: BusinessLoopAuthoringState,
  formData: FormData,
): Promise<BusinessLoopAuthoringState> {
  try {
    const { organizationId } = await requireOrgAdmin();
    const loopId = text(formData, "loopId", { min: 1, max: 120 });
    const loop = await prisma.businessLoop.findFirst({
      where: { id: loopId, organizationId, status: "DRAFT" },
      select: {
        id: true,
        name: true,
        versions: {
          where: { status: "DRAFT" },
          select: { id: true },
          orderBy: { version: "desc" },
          take: 1,
        },
        _count: {
          select: {
            activities: true,
            edges: true,
          },
        },
      },
    });
    if (!loop) {
      const publishedLoop = await prisma.businessLoop.findFirst({
        where: { id: loopId, organizationId, status: "ACTIVE" },
        select: {
          versions: {
            where: { status: "PUBLISHED" },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (publishedLoop?.versions[0]) {
        revalidatePath("/app/organization/business-loops");
        return { success: "业务回路已经是正式版本。" };
      }
      throw new Error("只能发布草稿状态的业务回路。");
    }
    if (!loop.versions[0]) throw new Error("业务回路草稿缺少版本记录。");
    if (loop._count.activities < 1 || loop._count.edges < 1) {
      throw new Error("发布前至少需要一个活动和一个价值或数据流。");
    }

    await prisma.$transaction([
      prisma.businessLoopVersion.updateMany({
        where: { organizationId, businessLoopId: loop.id, status: "PUBLISHED" },
        data: { status: "SUPERSEDED" },
      }),
      prisma.businessLoopVersion.update({
        where: { id: loop.versions[0].id },
        data: { status: "PUBLISHED", publishedAt: new Date(), summary: `已发布：${loop.name}` },
      }),
      prisma.businessLoop.update({
        where: { id: loop.id },
        data: { status: "ACTIVE" },
      }),
    ]);
    revalidatePath("/app/organization/business-loops");
    return { success: "业务回路已发布为正式版本。" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "业务回路发布失败。" };
  }
}
