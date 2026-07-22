import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase/pool";

const preworkSchema = z.object({
  name: z.string().trim().min(1, "请填写姓名").max(80),
  workContext: z.string().trim().min(1, "请填写主要工作场景").max(200),
  aiFrequency: z.string().trim().min(1, "请选择 AI 使用频率").max(80),
  aiUses: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  stepclaw: z.string().trim().max(80).optional(),
  ima: z.string().trim().max(80).optional(),
  obsidian: z.string().trim().max(80).optional(),
  toolIssue: z.string().trim().max(1200).optional(),
  targetTask: z.string().trim().min(1, "请填写现场任务").max(1600),
  goals: z.array(z.string().trim().min(1).max(120)).min(1, "请选择希望达成的结果").max(8),
  bringMaterial: z.string().trim().min(1, "请选择是否带真实材料").max(120),
  materialType: z.string().trim().max(300).optional(),
  biggestQuestion: z.string().trim().max(1600).optional(),
});

function joinChoices(values: string[]) {
  return values.join("；");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runSlug: string }> }
) {
  const { runSlug } = await params;
  const parsed = preworkSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: parsed.error.issues[0]?.message ?? "请补全必填信息。" },
      { status: 400 }
    );
  }

  if (!db) {
    return NextResponse.json({ ok: false, reason: "Database is not configured" }, { status: 500 });
  }

  try {
    const event = await db.event.findUnique({
      where: { slug: runSlug },
      select: { id: true, organizationId: true, status: true },
    });

    if (!event?.id) {
      return NextResponse.json({ ok: false, reason: "工作坊入口不存在。" }, { status: 404 });
    }

    if (!["active", "draft"].includes(String(event.status))) {
      return NextResponse.json({ ok: false, reason: "工作坊入口当前不可提交。" }, { status: 403 });
    }

    const prework = parsed.data;
    const data = await db.toolSession.create({
      data: {
        toolId: "super-individual-prework",
        eventId: event.id,
        organizationId: event.organizationId ?? null,
        userId: null,
        participantId: null,
        mode: "workshop_prework",
        status: "submitted",
        participantSnapshot: {
          displayName: prework.name,
          role: prework.workContext,
        },
        context: {
          runSlug,
          useCase: "超级个体赋能工作坊课前问卷",
          dataScope: "课前准备、真实任务、工具安装和学习目标",
          expectedOutput: "帮助主办方安排现场辅导和分组支持",
        },
        responses: {
          workContext: prework.workContext,
          aiFrequency: prework.aiFrequency,
          aiUses: joinChoices(prework.aiUses),
          stepclaw: prework.stepclaw ?? "",
          ima: prework.ima ?? "",
          obsidian: prework.obsidian ?? "",
          toolIssue: prework.toolIssue ?? "",
          targetTask: prework.targetTask,
          goals: joinChoices(prework.goals),
          bringMaterial: prework.bringMaterial,
          materialType: prework.materialType ?? "",
          biggestQuestion: prework.biggestQuestion ?? "",
        },
        outputs: {
          toolName: "超级个体课前问卷",
          nextAction: prework.targetTask,
          report: {
            title: "超级个体赋能工作坊课前问卷",
            summary: `${prework.name} 的现场任务：${prework.targetTask}`,
            goals: prework.goals,
            toolReadiness: {
              stepclaw: prework.stepclaw ?? "",
              ima: prework.ima ?? "",
              obsidian: prework.obsidian ?? "",
            },
          },
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    console.error("Prework submission error:", error);
    return NextResponse.json({ ok: false, reason: "提交失败。" }, { status: 500 });
  }
}
