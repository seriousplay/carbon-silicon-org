"use server";

/**
 * AI 组织结构生成
 *
 * 用户输入行业和核心角色描述，AI 自动生成回路/角色/接口的初始结构。
 */

import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { isAIAvailable, askAI } from "@/lib/ai/provider";
import type { OrgTemplate, TemplateCircle, TemplateInterface } from "@/lib/org-templates";

export type GenerateState = { error?: string; template?: OrgTemplate } | undefined;

/**
 * 调用 AI 生成组织结构模板
 */
export async function generateOrgTemplateAction(
  industry: string,
  keyRoles: string
): Promise<GenerateState> {
  if (!isAIAvailable()) {
    return { error: "AI 未配置。请在组织设置中配置模型后重试，或使用预设模板。" };
  }

  if (!industry.trim() || !keyRoles.trim()) {
    return { error: "请填写行业方向和核心角色" };
  }

  const systemPrompt = `你是一个组织设计专家，精通 Holacracy 和回路制方法论。你需要根据用户的行业和核心角色，设计一个适合的组织初始结构。

重要：这是组织圈子/角色结构的初始化，不是业务回路设计。请使用「圈子」「团队」「组」等词来命名，严禁使用「回路」二字。

设计规则：
1. 设计 3-6 个圈子（Circle），每个圈子有明确的 Purpose（目的）
2. 每个圈子包含 2-5 个角色（Role），每个角色有名称、目的、职责
3. 圈子之间有 2-5 个接口契约（Interface），描述交付关系
4. 适合 5-50 人的创业团队
5. 用中文命名，圈子和角色名称应贴近实际业务（如：客户成功、数据工程、模型研发、产品设计）
6. 根圈子命名为与组织核心业务相关的名称（如：产品、技术、运营），不要用「主回路」

输出 JSON 格式（严格只返回 JSON）：
{
  "name": "模板名称",
  "description": "一句话描述",
  "circles": [
    {
      "key": "root",
      "name": "核心团队",
      "type": "PRODUCTION",
      "purpose": "组织根圈子",
      "isRoot": true,
      "roles": []
    },
    {
      "key": "unique-key",
      "name": "圈子名称（不要包含「回路」）",
      "type": "PRODUCTION",
      "purpose": "圈子目的一句话",
      "parentKey": "root",
      "roles": [
        {
          "name": "角色名",
          "purpose": "角色目的",
          "accountabilities": "职责1\\n职责2",
          "category": "EXPERT"
        }
      ]
    }
  ],
  "interfaces": [
    {
      "name": "接口名称",
      "fromKey": "供给圈子key",
      "toKey": "消费圈子key",
      "contractContent": "交付什么",
      "sla": "SLA约定",
      "acceptanceCriteria": "验收标准"
    }
  ]
}`;

  const userPrompt = `行业方向：${industry}\n核心角色和关键活动：${keyRoles}\n\n请为这个团队设计初始组织结构。`;

  try {
    const result = await askAI(systemPrompt, userPrompt, {
      temperature: 0.4,
      maxTokens: 4000,
    });

    const jsonStr = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    // 验证最小结构
    if (!parsed.circles || !Array.isArray(parsed.circles) || parsed.circles.length < 2) {
      return { error: "AI 生成的结构不完整，请补充更多信息后重试" };
    }

    // 确保有 root 圈子，命名为核心团队而非主回路
    if (!parsed.circles.some((c: TemplateCircle) => c.isRoot)) {
      parsed.circles.unshift({
        key: "root",
        name: "核心团队",
        type: "PRODUCTION",
        purpose: "组织根圈子",
        isRoot: true,
        roles: [],
      });
    }

    return { template: parsed as OrgTemplate };
  } catch (e) {
    console.error("AI 组织结构生成失败:", e);
    return { error: "AI 生成失败，请重试或使用预设模板" };
  }
}

/**
 * 用 AI 生成的模板初始化组织
 */
export async function initFromTemplateAction(
  template: OrgTemplate
): Promise<{ error?: string; ok?: boolean }> {
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();

  if (!person) return { error: "无法获取当前用户" };

  const existingCircles = await prisma.circle.count({
    where: { organizationId: orgId, status: { not: "ARCHIVED" } },
  });
  if (existingCircles > 1) {
    return { error: "组织已有多个回路，无法通过 AI 模板重新初始化。如需调整结构，请通过治理流程变更。" };
  }

  try {
    const existingRoot = await prisma.circle.findFirst({
      where: { organizationId: orgId, parentId: null },
    });

    const circleMap = new Map<string, string>();

    await prisma.$transaction(async (tx) => {
      const rootTemplate = template.circles.find((c) => c.isRoot);
      let rootId: string;

      if (rootTemplate && existingRoot) {
        await tx.circle.update({
          where: { id: existingRoot.id },
          data: {
            name: rootTemplate.name,
            purpose: rootTemplate.purpose,
            domain: rootTemplate.domain,
            leadPersonId: person.id,
          },
        });
        circleMap.set(rootTemplate.key, existingRoot.id);
        rootId = existingRoot.id;
      } else {
        const root = await tx.circle.create({
          data: {
            organizationId: orgId,
            name: rootTemplate?.name ?? "主回路",
            number: "CUSTOM",
            type: "PRODUCTION",
            purpose: rootTemplate?.purpose ?? "组织根回路",
            leadPersonId: person.id,
          },
        });
        circleMap.set(rootTemplate?.key ?? "root", root.id);
        rootId = root.id;
      }

      for (const ct of template.circles.filter((c) => !c.isRoot)) {
        const parentId = ct.parentKey
          ? circleMap.get(ct.parentKey) ?? rootId
          : rootId;

        const circle = await tx.circle.create({
          data: {
            organizationId: orgId,
            name: ct.name,
            number: "CUSTOM",
            type: ct.type as never,
            purpose: ct.purpose,
            domain: ct.domain,
            parentId,
            leadPersonId: person.id,
          },
        });
        circleMap.set(ct.key, circle.id);

        for (const rt of ct.roles ?? []) {
          await tx.roleDef.create({
            data: {
              organizationId: orgId,
              name: rt.name,
              purpose: rt.purpose,
              domain: rt.domain,
              accountabilities: rt.accountabilities,
              circleId: circle.id,
              category: (rt.category as never) ?? "EXPERT",
              ownershipType: "HOME",
            },
          });
        }
      }

      for (const intf of template.interfaces ?? []) {
        const fromCircleId = circleMap.get(intf.fromKey);
        const toCircleId = circleMap.get(intf.toKey);
        if (!fromCircleId || !toCircleId) continue;

        await tx.circleInterface.create({
          data: {
            organizationId: orgId,
            name: intf.name,
            fromCircleId,
            toCircleId,
            contractContent: intf.contractContent,
            sla: intf.sla,
            acceptanceCriteria: intf.acceptanceCriteria ?? "按约定",
            status: "READY",
            ownerId: person.id,
          },
        });
      }
    });

    revalidatePath("/app");
    revalidatePath("/app/circles");
    revalidatePath("/app/circles/map");
    revalidatePath("/app/setup");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("AI 模板初始化失败:", message);
    // 提供有意义的错误提示
    if (message.includes("Unique constraint") || message.includes("duplicate")) {
      return { error: "回路或角色名称重复，请重新生成模板。" };
    }
    if (message.includes("Foreign key") || message.includes("relation")) {
      return { error: "数据关联异常，请刷新页面后重试。" };
    }
    return { error: `初始化失败：${message.slice(0, 80)}` };
  }
}
