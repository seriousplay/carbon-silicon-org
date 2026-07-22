"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { isAIAvailable, askAI } from "@/lib/ai/provider";
import { PHASE_ORDER } from "./meeting-agent-phases";
import { COACH_PERSONAS } from "./coach-personas";

export type SendMessageState = { error?: string; ok?: boolean } | null;

// ─── AI 教练核心 ──────────────────────────────────────────────

async function generateCoachResponse(
  orgId: string,
  meetingId: string,
  phase: string,
  trigger: { type: "user_message" | "vote_complete" | "phase_change"; content?: string; voterRole?: string; voteStatus?: string },
): Promise<string | null> {
  const messages = await prisma.meetingMessage.findMany({
    where: { organizationId: orgId, meetingId },
    orderBy: { createdAt: "asc" },
    select: { role: true, senderRole: true, content: true, phase: true },
    take: 15,
  });

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { type: true, title: true },
  });

  const participants = await prisma.meetingParticipant.findMany({
    where: { organizationId: orgId, meetingId, status: "ONLINE" },
    select: { roleLabel: true },
  });

  const persona = COACH_PERSONAS[meeting?.type || "TACTICAL"] || COACH_PERSONAS.TACTICAL;

  const phaseLabels: Record<string, string> = {
    OPENING: "开场", TENSION_COLLECT: "张力收集", PROPOSAL: "提案提交",
    CLARIFY: "澄清提问", RESPONSE: "自由回应", AMEND: "提案打磨",
    VOTE: "反对表决", JUDGE: "反对判定", INTEGRATE: "整合决策", SUMMARY: "总结",
  };

  const phaseGuides: Record<string, string> = {
    OPENING: meeting?.type === "TACTICAL"
      ? `开场。说这两句话：1)"大家好，我是David。" 2)"请把想处理的张力提出来。格式：'/张力 [一句话描述]'。" 不寒暄，不废话。`
      : `开场。简短自我介绍，然后引导进入张力收集环节。`,
    TENSION_COLLECT: meeting?.type === "TACTICAL"
      ? `收集阶段。引导用户用"/张力 [描述]"格式提交。每收到一个，回复"收到。[编号]"并列入清单。不讨论、不评判。用户可随时追加。严禁编造或举例任何具体张力。`
      : `引导大家分享张力。`,
    PROPOSAL: meeting?.type === "TACTICAL"
      ? `处理阶段。从清单第一个开始。你只问一个问题："为了处理这个张力，你需要什么？" 帮他明确下一步行动。不深入分析，不跑题。目标：3分钟内出下一步。`
      : `帮提案人把模糊的想法变成清晰的提案。`,
    CLARIFY: `鼓励提问。如果没人提问，主动邀请沉默的参与者。问题要具体。`,
    RESPONSE: `收集大家的真实看法。提案人只听不说。如果有人的回应太空泛，追问具体细节。`,
    AMEND: `帮提案人判断是否需要修改。如果有明显的改进空间，直接建议。`,
    VOTE: `已经进入表决，不需要教练发言。`,
    INTEGRATE: `引导提案人和反对者一起找方案。建议具体的整合方向，不要只说"你们讨论一下"。`,
  };

  const conversationText = messages.map((m) => {
    const speaker = m.role === "COACH" ? persona.name : m.role === "SYSTEM" ? "[系统]" : m.senderRole || "参与者";
    return `${speaker}（${phaseLabels[m.phase] || m.phase}）：${m.content}`;
  }).join("\n\n");

  const systemPrompt = `${persona.systemPrompt}

当前：${meeting?.type === "GOVERNANCE" ? "治理会" : "战术会"}「${meeting?.title}」
阶段：${phaseLabels[phase] || phase}
在线：${participants.map((p) => p.roleLabel).join("、")}

任务：${phaseGuides[phase] || "引导会议。"}

回复规则：只输出你要说的话，1-3句中文。用日常语言，不要术语堆砌。参与者输入太模糊时追问。`;

  const userPrompt = `对话历史：\n${conversationText}\n\n${trigger.type === "user_message" ? `刚刚${trigger.content ? `收到消息："${trigger.content}"` : "收到一条消息"}` : trigger.type === "vote_complete" ? `表决完成` : "阶段变更"}\n\n请以 ${persona.name} 的身份回应。`;

  try {
    const result = await askAI(systemPrompt, userPrompt, { temperature: 0.6, maxTokens: 300, timeoutMs: 9000 });
    return result.trim();
  } catch (e) {
    console.error("AI coach error:", e);
    return null;
  }
}

// 降级方案：AI不可用时的规则版
function fallbackCoachMessage(phase: string, isTactical: boolean): string {
  const david: Record<string, string> = {
    TENSION_COLLECT: "请用 '/张力 [一句话描述]' 的格式提出来。",
    PROPOSAL: "为了处理这个张力，你需要什么？",
    CLARIFY: "下一步行动是什么？",
    RESPONSE: "还有其他需要吗？",
    AMEND: "你得到需要的东西了吗？",
    INTEGRATE: "好的。下一个张力。",
  };
  const brian: Record<string, string> = {
    TENSION_COLLECT: "请继续说。这个张力具体是什么？",
    PROPOSAL: "收到。提案还需要补充什么吗？",
    CLARIFY: "还有其他问题吗？",
    RESPONSE: "还有谁要回应吗？",
    AMEND: "提案人可以修改，也可以保持。",
    INTEGRATE: "请提案人和反对者一起整合。",
  };
  const map = isTactical ? david : brian;
  return map[phase] || "请继续。";
}

// ─── Server Actions ───────────────────────────────────────────

export async function sendMeetingMessageAction(
  _prev: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  if (!person) return { error: "无法获取当前用户" };

  const meetingId = String(formData.get("meetingId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const phase = String(formData.get("phase") ?? "PROPOSAL");
  const action = String(formData.get("action") ?? "");

  if (!meetingId || (!content && !action)) return { error: "消息不能为空" };

  const participant = await prisma.meetingParticipant.findUnique({
    where: { organizationId_meetingId_personId: { organizationId: orgId, meetingId, personId: person.id } },
  });
  const roleLabel = participant?.roleLabel || person.name;

  try {
    // 表决操作
    if (action === "vote-approve" || action === "vote-object") {
      const voteStatus = action === "vote-approve" ? "APPROVE" : "OBJECT";
      const voteReason = String(formData.get("voteReason") ?? "").trim();
      const voteSuggestion = String(formData.get("voteSuggestion") ?? "").trim();

      await prisma.meetingParticipant.update({
        where: { organizationId_meetingId_personId: { organizationId: orgId, meetingId, personId: person.id } },
        data: {
          voteStatus,
          voteReason: voteStatus === "OBJECT" ? voteReason : null,
          voteSuggestion: voteStatus === "OBJECT" ? voteSuggestion : null,
          voteSubmittedAt: new Date(),
          lastActiveAt: new Date(),
        },
      });

      await prisma.meetingMessage.create({
        data: {
          organizationId: orgId, meetingId, senderId: person.id, senderRole: roleLabel,
          role: "SYSTEM",
          content: voteStatus === "APPROVE" ? `${roleLabel}：不反对 ✅` : `${roleLabel}：反对 ❌${voteReason ? `\n理由：${voteReason}` : ""}${voteSuggestion ? `\n整合建议：${voteSuggestion}` : ""}`,
          phase,
        },
      });

      await checkAndAdvanceVote(orgId, meetingId);
      revalidatePath(`/app/meetings/${meetingId}`);
      return { ok: true };
    }

    // 阶段推进
    if (action === "phase-advance") {
      await advancePhase(orgId, meetingId, phase);
      revalidatePath(`/app/meetings/${meetingId}`);
      return { ok: true };
    }

    // 普通用户消息
    if (content) {
      await prisma.meetingMessage.create({
        data: {
          organizationId: orgId, meetingId, senderId: person.id, senderRole: roleLabel,
          role: "USER", content, phase,
        },
      });

      await prisma.meetingParticipant.updateMany({
        where: { organizationId: orgId, meetingId, personId: person.id },
        data: { lastActiveAt: new Date() },
      });

      // AI 教练根据上下文回应
      const coachReply = await generateCoachResponse(orgId, meetingId, phase, {
        type: "user_message",
        content,
      });

      if (coachReply) {
        await createCoachMessage(orgId, meetingId, phase, coachReply);
      } else {
        const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { type: true } });
        await createCoachMessage(orgId, meetingId, phase, fallbackCoachMessage(phase, meeting?.type === "TACTICAL"));
      }
    }

    revalidatePath(`/app/meetings/${meetingId}`);
    return { ok: true };
  } catch (e) {
    console.error("Meeting message error:", e);
    return { error: "发送失败，请重试" };
  }
}

async function checkAndAdvanceVote(orgId: string, meetingId: string) {
  const onlineParticipants = await prisma.meetingParticipant.findMany({
    where: { organizationId: orgId, meetingId, status: "ONLINE" },
    select: { id: true, voteStatus: true, roleLabel: true, voteReason: true, voteSuggestion: true },
  });

  const allVoted = onlineParticipants.every((p) => p.voteStatus !== null);
  if (!allVoted) return;

  const objections = onlineParticipants.filter((p) => p.voteStatus === "OBJECT");

  if (objections.length === 0) {
    // AI 总结表决结果
    const coachReply = await generateCoachResponse(orgId, meetingId, "JUDGE", {
      type: "vote_complete",
      voteStatus: "ALL_APPROVE",
    });
    await createCoachMessage(orgId, meetingId, "JUDGE", coachReply || "全员不反对。提案通过。");
    await advancePhase(orgId, meetingId, "JUDGE");
  } else {
    const objectionText = objections.map((o) => `· ${o.roleLabel}：${o.voteReason || "未说明"}${o.voteSuggestion ? `（建议：${o.voteSuggestion}）` : ""}`).join("\n");
    
    // AI 判定反对有效性
    const coachReply = await generateCoachResponse(orgId, meetingId, "JUDGE", {
      type: "vote_complete",
      voteStatus: "HAS_OBJECTIONS",
    });
    
    await createCoachMessage(orgId, meetingId, "JUDGE", coachReply || `收到 ${objections.length} 个反对。\n\n${objectionText}\n\n所有反对暂判定为有效。进入整合环节。`);
    await updateMeetingPhase(orgId, meetingId, "INTEGRATE");
  }
}

async function advancePhase(orgId: string, meetingId: string, currentPhase: string) {
  const nextPhase = getNextPhase(currentPhase);
  if (!nextPhase) return;

  // AI 生成阶段切换引导语
  const coachReply = await generateCoachResponse(orgId, meetingId, nextPhase, {
    type: "phase_change",
  });
  await createCoachMessage(orgId, meetingId, nextPhase, coachReply || getDefaultPhaseMessage(nextPhase));
  await updateMeetingPhase(orgId, meetingId, nextPhase);
}

function getDefaultPhaseMessage(phase: string): string {
  const defaults: Record<string, string> = {
    TENSION_COLLECT: "请各位分享你感知到的组织张力。",
    PROPOSAL: "请提案人提交提案。",
    CLARIFY: "请各位提出疑问。提案人可以选择回答。",
    RESPONSE: "请各位分享你的回应。提案人请只观察。",
    AMEND: "提案人可以修改提案，或保持不变。",
    SUMMARY: "本次会议已完成。",
  };
  return defaults[phase] || "请继续。";
}

function getNextPhase(current: string): string | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

async function createCoachMessage(orgId: string, meetingId: string, phase: string, content: string) {
  await prisma.meetingMessage.create({
    data: { organizationId: orgId, meetingId, senderId: null, senderRole: "会议教练", role: "COACH", content, phase },
  });
}

async function updateMeetingPhase(orgId: string, meetingId: string, phase: string) {
  await prisma.meeting.update({ where: { id: meetingId }, data: { currentPhase: phase } });
}

export async function joinMeetingAction(meetingId: string): Promise<{ ok?: boolean; error?: string }> {
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  if (!person) return { error: "无法获取用户" };

  await prisma.meetingParticipant.upsert({
    where: { organizationId_meetingId_personId: { organizationId: orgId, meetingId, personId: person.id } },
    create: { organizationId: orgId, meetingId, personId: person.id, roleLabel: person.name, status: "ONLINE", joinedAt: new Date() },
    update: { status: "ONLINE", joinedAt: new Date(), lastActiveAt: new Date() },
  });

  revalidatePath(`/app/meetings/${meetingId}`);
  return { ok: true };
}

export async function initMeetingCoachAction(meetingId: string): Promise<{ ok?: boolean; error?: string }> {
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  if (!person) return { error: "无法获取用户" };

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, type: true, currentPhase: true, participants: { select: { id: true, name: true } } },
  });
  if (!meeting) return { error: "会议不存在" };

  const existing = await prisma.meetingMessage.findFirst({ where: { meetingId, role: "COACH" } });
  if (existing) return { ok: true };

  for (const p of meeting.participants) {
    await prisma.meetingParticipant.upsert({
      where: { organizationId_meetingId_personId: { organizationId: orgId, meetingId, personId: p.id } },
      create: { organizationId: orgId, meetingId, personId: p.id, roleLabel: p.name, status: p.id === person.id ? "ONLINE" : "INVITED", joinedAt: p.id === person.id ? new Date() : null },
      update: {},
    });
  }

  // AI 生成开场白（带教练人格）
  const persona = COACH_PERSONAS[meeting.type] || COACH_PERSONAS.TACTICAL;
  const openingMessage = isAIAvailable()
    ? await generateCoachResponse(orgId, meetingId, "OPENING", { type: "phase_change" })
    : `${persona.avatarEmoji} 大家好，我是${persona.name}，${persona.title}。\n\n${persona.bio.split("。")[0]}。\n\n让我们开始本次${meeting.type === "GOVERNANCE" ? "治理会" : "战术会"}。`;

  await createCoachMessage(orgId, meetingId, "OPENING", openingMessage || `${persona.avatarEmoji} 大家好，我是${persona.name}，${persona.title}。\n\n${persona.bio.split("。")[0]}。\n\n第一步，构建张力清单。请用一个词或短语，标记你希望处理的一个张力。一个短语代表一个张力。`);

  // 治理会和战术会都先收集张力
  const tensionMsg = isAIAvailable()
    ? await generateCoachResponse(orgId, meetingId, "TENSION_COLLECT", { type: "phase_change" })
    : "请用一个词或短语来标记你想处理的张力。一个短语代表一个张力。";
  await createCoachMessage(orgId, meetingId, "TENSION_COLLECT", tensionMsg || "请用一个词或短语来标记你想处理的张力。");
  await updateMeetingPhase(orgId, meetingId, "TENSION_COLLECT");

  revalidatePath(`/app/meetings/${meetingId}`);
  return { ok: true };
}
