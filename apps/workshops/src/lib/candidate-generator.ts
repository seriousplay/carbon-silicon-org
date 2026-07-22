import "server-only";

import { createId } from "./ids";
import type { DraftCandidateRecord } from "./types";

type GenerateDraftInput = {
  prompt: string;
  industry: string;
  business: string;
  title: string;
  venue: string;
  tagline: string;
};

const SYSTEM_PROMPT = [
  "你是现场业务回路设计助手。",
  "任务：根据用户输入的关键提示词，生成 3 条可落地、可编辑、可命名的候选业务回路。",
  "要求：",
  "1. 只输出 JSON，不要 Markdown，不要解释。",
  "2. 输出格式必须是 {\"candidates\":[...]}。",
  "3. candidates 必须刚好 3 条。",
  "4. 每条只保留 name、scenario、routeFrom、routeTo、notes、aiWork、humanWork、successStandard 八个字段。",
  "5. name 要简短，方便现场口头命名。",
  "6. scenario 要具体到业务场景，不要抽象套话。",
  "7. routeFrom 要写触发源或输入信号，routeTo 要写明确交付结果。",
  "8. notes 要说明为什么这条回路值得现场讨论。",
  "9. 还要补充 aiWork、humanWork、successStandard 三个字段，分别写 AI 做什么、人做什么、成功标准是什么。",
].join("\n");

function cleanText(value: string, fallback: string) {
  return value.trim() || fallback;
}

function normalizeSeed(text: string) {
  return text
    .replace(/[，。！？；、\n\r\t]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function pickTopic(input: GenerateDraftInput) {
  const tokens = [
    ...normalizeSeed(input.prompt),
    ...normalizeSeed(input.title),
    ...normalizeSeed(input.tagline),
    ...normalizeSeed(input.venue),
  ];
  return tokens[0] ?? "关键业务";
}

function makeFallbackCandidates(input: GenerateDraftInput): DraftCandidateRecord[] {
  const topic = pickTopic(input);
  const industry = cleanText(input.industry, "目标行业");
  const business = cleanText(input.business, "主营业务");
  const title = cleanText(input.title, "现场活动");
  const venue = cleanText(input.venue, "线下现场");

  const seeds: Array<{ name: string; scenario: string; routeFrom: string; routeTo: string; notes: string; aiWork: string; humanWork: string; successStandard: string }> = [
    {
      name: "止损回路",
      scenario: `${industry} 里围绕 ${business} 的快速止损场景`,
      routeFrom: `从 ${venue} 的一线异常、投诉或卡点信号`,
      routeTo: "到 24 小时内给出可执行处置方案",
      notes: `适合先锁定最痛的业务损失点，围绕“${industry} / ${business}”快速收敛。`,
      aiWork: "自动汇总异常信号、生成处置建议、持续跟踪结果。",
      humanWork: "确认优先级、拍板是否采纳、处理例外并承担结果。",
      successStandard: "4-6 周内能看到损失下降或响应提速，并能复盘。",
    },
    {
      name: "数据回路",
      scenario: `${industry} 里围绕 ${business} 的数据闭环场景`,
      routeFrom: "从已有表单、工单、埋点或现场记录",
      routeTo: "到输出可复用的判断依据和下一步动作",
      notes: "适合验证信息是否足够支撑判断，避免只凭经验拍板。",
      aiWork: "自动整理数据、提炼规律、给出判断建议。",
      humanWork: "校验数据口径、定义阈值、决定是否进入执行。",
      successStandard: "4-6 周内判断时间缩短，且关键指标能被持续追踪。",
    },
    {
      name: "推进回路",
      scenario: `${industry} 里围绕 ${business} 的跨人协同推进场景`,
      routeFrom: "从责任分散、协同断点或反复催办",
      routeTo: "到明确 owner、时限和下一次回收动作",
      notes: `适合把“谁来做、做到什么程度”一次说清，减少现场空转。${title} / ${topic} 可作为讨论锚点。`,
      aiWork: "自动提醒、汇总阻塞、生成协同建议和下一步动作。",
      humanWork: "分派责任、处理跨部门争议、在关键节点做决策。",
      successStandard: "4-6 周内协同次数减少，关键动作按时闭环。",
    },
  ];

  return seeds.map((seed, index) => ({
    id: createId(`draft${index + 1}`),
    name: seed.name,
    scenario: seed.scenario,
    routeFrom: seed.routeFrom,
    routeTo: seed.routeTo,
    notes: seed.notes,
    aiWork: seed.aiWork,
    humanWork: seed.humanWork,
    successStandard: seed.successStandard,
    source: "AI生成" as const,
  }));
}

function extractJsonText(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const arrayStart = trimmed.indexOf("[");
  const objectStart = trimmed.indexOf("{");
  if (arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)) {
    const end = trimmed.lastIndexOf("]");
    return end >= arrayStart ? trimmed.slice(arrayStart, end + 1) : trimmed;
  }
  if (objectStart >= 0) {
    const end = trimmed.lastIndexOf("}");
    return end >= objectStart ? trimmed.slice(objectStart, end + 1) : trimmed;
  }
  return trimmed;
}

function normalizeModelCandidates(payload: unknown): DraftCandidateRecord[] {
  const rawCandidates = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { candidates?: unknown[] }).candidates)
      ? (payload as { candidates: unknown[] }).candidates
      : [];

  const normalized = rawCandidates.slice(0, 3).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const name = String(candidate.name ?? "").trim() || `候选 ${index + 1}`;
    const scenario = String(candidate.scenario ?? "").trim();
    const routeFrom = String(candidate.routeFrom ?? "").trim();
    const routeTo = String(candidate.routeTo ?? "").trim();
    const notes = String(candidate.notes ?? "").trim();
    const aiWork = String(candidate.aiWork ?? "").trim();
    const humanWork = String(candidate.humanWork ?? "").trim();
    const successStandard = String(candidate.successStandard ?? "").trim();
    if (!scenario || !routeFrom || !routeTo || !notes || !aiWork || !humanWork || !successStandard) return [];
    return [{
      id: String(candidate.id ?? createId(`draft${index + 1}`)),
      name,
      scenario,
      routeFrom,
      routeTo,
      notes,
      aiWork,
      humanWork,
      successStandard,
      source: "AI生成" as const,
    }];
  });

  return normalized.length === 3 ? normalized : [];
}

async function callModel(input: GenerateDraftInput) {
  const configuredUrl = process.env.MODEL_API_URL?.replace(/\/$/, "");
  const baseUrl = process.env.MODEL_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.MODEL_API_KEY;
  const model = process.env.MODEL_NAME;
  if ((!configuredUrl && !baseUrl) || !apiKey || !model) {
    throw new Error("模型服务尚未配置");
  }

  const apiRoot = baseUrl?.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  const endpoint = configuredUrl || `${apiRoot}/chat/completions`;
  const usesResponsesApi = endpoint.endsWith("/responses");
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        "用户输入：",
        `关键提示词：${input.prompt}`,
        `行业：${input.industry}`,
        `主营业务：${input.business}`,
        `活动名称：${input.title}`,
        `场地：${input.venue}`,
        `一句话说明：${input.tagline}`,
        "",
        "请直接输出 JSON。",
      ].join("\n"),
    },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.MODEL_TIMEOUT_MS || 60000));
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(
        usesResponsesApi
          ? { model, input: messages, temperature: 0.35 }
          : { model, messages, temperature: 0.35 },
      ),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`模型请求失败：${response.status}`);
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text =
      payload.output_text ||
      payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text" || item.type === "text")?.text ||
      payload.choices?.[0]?.message?.content ||
      "";

    const parsedText = extractJsonText(text);
    const parsed = JSON.parse(parsedText) as unknown;
    const candidates = normalizeModelCandidates(parsed);
    if (!candidates.length) {
      throw new Error("模型未返回 3 条有效候选");
    }
    return candidates;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateDraftCandidates(input: GenerateDraftInput) {
  const prompt = cleanText(input.prompt, "");
  const industry = cleanText(input.industry, "");
  const business = cleanText(input.business, "");
  if (!prompt || !industry || !business) {
    throw new Error("请输入行业、主营业务和关键提示词");
  }

  try {
    const candidates = await callModel(input);
    return { candidates, source: "model" as const };
  } catch {
    return { candidates: makeFallbackCandidates(input), source: "fallback" as const };
  }
}
