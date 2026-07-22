import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const multiChoiceSchema = z.array(z.string().min(1).max(120)).min(1).max(8);

const feedbackSchema = z.object({
  displayName: z.string().max(80).optional(),
  mostUsefulFrameworks: multiChoiceSchema,
  mostUsefulReason: z.string().max(1200).optional(),
  hardestFrameworks: multiChoiceSchema,
  hardestReason: z.string().max(1200).optional(),
  conceptsNeedRename: multiChoiceSchema,
  renameSuggestion: z.string().max(1200).optional(),
  cohortExperiment: z.string().max(1600).optional(),
  claritySignal: z.string().max(120).optional(),
  extraFeedback: z.string().max(1600).optional(),
});

function joinChoices(values: string[]) {
  return values.join("；");
}

export async function POST(request: Request, { params }: { params: Promise<{ runSlug: string }> }) {
  const { runSlug } = await params;
  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "请至少完成三个核心选择题。" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase service role is not configured" }, { status: 500 });
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id,organization_id,status")
    .eq("slug", runSlug)
    .maybeSingle();

  if (eventError || !event?.id) {
    return NextResponse.json({ ok: false, reason: eventError?.message ?? "活动入口不存在。" }, { status: 404 });
  }

  if (!["active", "draft"].includes(String(event.status))) {
    return NextResponse.json({ ok: false, reason: "活动入口当前不可提交。" }, { status: 403 });
  }

  const feedback = parsed.data;
  const participant = {
    displayName: feedback.displayName?.trim() || "匿名参与者",
  };

  const { data, error } = await supabase
    .from("tool_sessions")
    .insert({
      tool_id: "workshop-final-feedback",
      event_id: event.id,
      organization_id: event.organization_id ?? null,
      user_id: null,
      participant_id: null,
      mode: "workshop_feedback",
      status: "submitted",
      participant_snapshot: participant,
      context: {
        runSlug,
        useCase: "工作坊最终反馈",
        dataScope: "P41 方法论体检",
        expectedOutput: "框架有效性、可用性、命名和同行者实验反馈",
      },
      responses: {
        mostUsefulFrameworks: joinChoices(feedback.mostUsefulFrameworks),
        mostUsefulReason: feedback.mostUsefulReason ?? "",
        hardestFrameworks: joinChoices(feedback.hardestFrameworks),
        hardestReason: feedback.hardestReason ?? "",
        conceptsNeedRename: joinChoices(feedback.conceptsNeedRename),
        renameSuggestion: feedback.renameSuggestion ?? "",
        cohortExperiment: feedback.cohortExperiment ?? "",
        claritySignal: feedback.claritySignal ?? "",
        extraFeedback: feedback.extraFeedback ?? "",
      },
      outputs: {
        toolName: "工作坊最终反馈",
        nextAction: feedback.cohortExperiment ?? "",
        report: {
          title: "工作坊最终反馈",
          summary: `最有用：${feedback.mostUsefulFrameworks.join("、")}；最难用：${feedback.hardestFrameworks.join("、")}；最需改名：${feedback.conceptsNeedRename.join("、")}`,
        },
      },
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, reason: error?.message ?? "提交失败。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
