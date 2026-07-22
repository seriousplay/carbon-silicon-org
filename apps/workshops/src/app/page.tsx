"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, QrCode, Sparkles } from "lucide-react";
import { APP_NAME, buildPublicUrl, joinAppPath } from "@/lib/config";
import type { DraftCandidateRecord, EventRecord } from "@/lib/types";
import { PublicQr } from "@/components/url-tools";

type EventSummary = Pick<EventRecord, "id" | "title" | "venue" | "tagline" | "createdAt" | "updatedAt">;

type CreateForm = {
  title: string;
  venue: string;
  tagline: string;
};

const defaultForm: CreateForm = {
  title: "高维学堂现场共创",
  venue: "线下闭门工作坊",
  tagline: "扫码即进，5 分钟锁定 3 条候选回路。",
};

const defaultPrompt = [
  "我所在的行业是______，公司主营______。",
  "请帮我列出 3 条最适合用 AI 重构的业务回路。",
  "每条回路的格式要求：从 [具体的触发源/数据入口] 到 [具体的交付物/业务结果]。",
  "然后列明 AI 做什么、人做什么、成功标准是什么。",
  "附加要求：每条回路必须是真业务痛点、有可衡量数据、有明确负责人、能在4-6周内看见结果。",
  "正确示例：",
  "\"从亚马逊品类搜索和竞品价格抓取，到输出高利润套利单品采购列表\"",
  "\"从客户投诉工单和NPS低分信号触达，到48小时内给出个性化解决方案\"",
  "\"从产线传感器毫秒级振动温度信号采集，到提前1个月输出故障预警和备件采购建议\"",
  "错误示例（不要这样写）：",
  "\"从经验驱动到数据驱动\" —— 这是范式口号，不是回路边界",
  "\"从人工到智能\" —— 不知道起点和终点在哪",
  "\"从低效到高效\" —— 太抽象，没法落地",
].join("\n");

function makeLocalId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDraft(candidate: DraftCandidateRecord, index: number): DraftCandidateRecord {
  return {
    id: candidate.id || makeLocalId(`draft${index + 1}`),
    name: candidate.name || `候选 ${index + 1}`,
    scenario: candidate.scenario,
    routeFrom: candidate.routeFrom,
    routeTo: candidate.routeTo,
    notes: candidate.notes,
    aiWork: candidate.aiWork || "",
    humanWork: candidate.humanWork || "",
    successStandard: candidate.successStandard || "",
    source: candidate.source,
  };
}

export default function HomePage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [form, setForm] = useState<CreateForm>(defaultForm);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [industry, setIndustry] = useState("");
  const [business, setBusiness] = useState("");
  const [drafts, setDrafts] = useState<DraftCandidateRecord[]>([]);
  const [draftSource, setDraftSource] = useState<"模型" | "本地回退" | "">("");
  const [draftBusy, setDraftBusy] = useState(false);
  const [eventBusy, setEventBusy] = useState(false);
  const [created, setCreated] = useState<EventRecord | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/field-cocreation/api/events")
      .then((response) => response.json())
      .then((data: { events?: EventSummary[] }) => {
        setEvents(data.events ?? []);
      })
      .catch(() => undefined);
  }, []);

  const participantUrl = created ? buildPublicUrl(`/e/${created.id}`) : "";
  const dashboardUrl = created ? buildPublicUrl(`/admin/${created.id}?key=${created.adminKey}`) : "";
  const presentUrl = created ? buildPublicUrl(`/present/${created.id}?key=${created.adminKey}`) : "";

  const recentEvents = useMemo(() => events.slice(0, 3), [events]);
  const canCreate = drafts.length === 3;

  async function generateDrafts() {
    setDraftError(null);
    setDraftBusy(true);
    try {
      const response = await fetch("/field-cocreation/api/ai/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          industry,
          business,
          title: form.title,
          venue: form.venue,
          tagline: form.tagline,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setDraftError(data.error || "生成失败");
        return;
      }
      const nextDrafts = (data.candidates as DraftCandidateRecord[] | undefined) ?? [];
      setDrafts(nextDrafts.map((candidate, index) => normalizeDraft(candidate, index)));
      setDraftSource(data.source === "model" ? "模型" : "本地回退");
    } catch {
      setDraftError("网络请求失败");
    } finally {
      setDraftBusy(false);
    }
  }

  async function createEvent() {
    setEventError(null);
    setEventBusy(true);
    try {
      const response = await fetch("/field-cocreation/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          draftCandidates: drafts,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setEventError(data.error || "创建失败");
        return;
      }
      const nextEvent = data.event as EventRecord;
      setCreated(nextEvent);
      setEvents((current) => [nextEvent, ...current.filter((item) => item.id !== nextEvent.id)]);
    } catch {
      setEventError("网络请求失败");
    } finally {
      setEventBusy(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  function updateDraft(candidateId: string, patch: Partial<DraftCandidateRecord>) {
    setDrafts((current) =>
      current.map((candidate) => {
        if (candidate.id !== candidateId) return candidate;
        return { ...candidate, ...patch };
      }),
    );
  }

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />
      <header className="shell topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span>回</span>
          </div>
          <div>
            <small>{APP_NAME}</small>
            <strong>业务回路锁定器</strong>
          </div>
        </div>
        <div className="top-links">
          <a className="chip" href="#generate">
            生成回路
          </a>
          <a className="chip" href="#recent">
            最近活动
          </a>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">FIELD PWA / 01</p>
            <h1>业务回路锁定器</h1>
            <p>
              输入关键提示词，AI 先给出 3 条备选回路。现场只做一件事：把候选编辑、命名、锁定，然后扫码进入。
            </p>
            <div className="hero-actions">
              <button className="solid-btn" disabled={draftBusy} onClick={() => void generateDrafts()} type="button">
                {draftBusy ? "正在生成…" : "生成 3 条备选回路"} <Sparkles size={16} />
              </button>
              <a className="ghost-btn" href="#generate">
                去编辑候选 <ArrowRight size={16} />
              </a>
            </div>
            {draftError ? (
              <p className="muted" style={{ color: "var(--danger)", marginTop: 14 }}>
                {draftError}
              </p>
            ) : null}
            {eventError ? (
              <p className="muted" style={{ color: "var(--danger)", marginTop: 14 }}>
                {eventError}
              </p>
            ) : null}
          </div>

          <aside className="hero-panel">
            <div className="panel-title">
              <h2>现场入口</h2>
              <p>扫码 / 打开链接 / 生成新活动</p>
            </div>
            {created ? (
              <div className="qr-grid">
                <PublicQr path={`/e/${created.id}`} label="参与者扫码入口" />
                <PublicQr path={`/admin/${created.id}?key=${created.adminKey}`} label="讲师看板入口" />
              </div>
            ) : (
              <div className="card" style={{ marginTop: 16 }}>
                <p className="muted">
                  先生成 3 条候选回路，再创建活动。系统会自动把候选带到参与者流程里。
                </p>
              </div>
            )}
            {created ? (
              <div className="stack" style={{ marginTop: 14 }}>
                <div className="summary-box">
                  <div className="label">参与者链接</div>
                  <strong>{participantUrl}</strong>
                  <button className="chip" onClick={() => void copy(participantUrl)} style={{ marginTop: 10 }} type="button">
                    <Copy size={14} /> 复制
                  </button>
                </div>
                <div className="summary-box">
                  <div className="label">讲师链接</div>
                  <strong>{dashboardUrl}</strong>
                  <button className="chip" onClick={() => void copy(dashboardUrl)} style={{ marginTop: 10 }} type="button">
                    <Copy size={14} /> 复制
                  </button>
                </div>
                <div className="summary-box">
                  <div className="label">投屏链接</div>
                  <strong>{presentUrl}</strong>
                  <button className="chip" onClick={() => void copy(presentUrl)} style={{ marginTop: 10 }} type="button">
                    <Copy size={14} /> 复制
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </section>

        <section className="section" id="generate">
          <div className="section-grid">
            <div className="card">
              <div className="section-title">
                <p className="eyebrow">PROMPT</p>
                <h2>输入行业、主营业务和提示词</h2>
              </div>
              <div className="stack" style={{ marginTop: 16 }}>
                <div className="field-grid">
                  <div className="field">
                    <label>行业</label>
                    <input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="例如：亚马逊套利、SaaS、制造业" />
                  </div>
                  <div className="field">
                    <label>主营业务</label>
                    <input value={business} onChange={(event) => setBusiness(event.target.value)} placeholder="例如：跨境选品和供应链协同" />
                  </div>
                  <div className="field">
                    <label>活动名称</label>
                    <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>预设提示词</label>
                  <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：围绕续费流失、客服转单、销售跟进，生成可现场锁定的短回路" />
                </div>
                <div className="field-grid">
                  <div className="field">
                    <label>场地</label>
                    <input value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} />
                  </div>
                  <div className="field">
                    <label>一句话说明</label>
                    <input value={form.tagline} onChange={(event) => setForm({ ...form, tagline: event.target.value })} />
                  </div>
                </div>
                <div className="hero-actions">
                  <button className="solid-btn" disabled={draftBusy} onClick={() => void generateDrafts()} type="button">
                    {draftBusy ? "正在生成…" : "生成 3 条备选回路"} <Sparkles size={16} />
                  </button>
                  <button className="ghost-btn" disabled={!canCreate || eventBusy} onClick={() => void createEvent()} type="button">
                    {eventBusy ? "正在创建…" : "用这 3 条候选创建活动"} <QrCode size={16} />
                  </button>
                </div>
                <p className="muted">
                  {draftSource
                    ? `当前生成来源：${draftSource}。你可以直接改名、改场景、改从哪里进、改输出到哪里、改 AI/人/成功标准。`
                    : "先生成 3 条候选回路，再创建活动。"}
                </p>
              </div>
            </div>

            <div className="card">
              <div className="section-title">
                <p className="eyebrow">EDIT</p>
                <h2>编辑和命名 3 条候选回路</h2>
              </div>
              <div className="stack" style={{ marginTop: 16 }}>
                {drafts.length ? (
                  drafts.map((candidate, index) => (
                    <div key={candidate.id} className="candidate-card">
                      <div className="candidate-head">
                        <strong>候选 {index + 1}</strong>
                        <span className="chip">{candidate.source}</span>
                      </div>
                      <div className="field-grid candidate-name-row">
                        <div className="field">
                          <label>名称</label>
                          <input
                            value={candidate.name}
                            onChange={(event) => updateDraft(candidate.id, { name: event.target.value })}
                            placeholder="例如：止损回路"
                          />
                        </div>
                        <div className="field">
                          <label>场景</label>
                          <input
                            value={candidate.scenario}
                            onChange={(event) => updateDraft(candidate.id, { scenario: event.target.value })}
                            placeholder="例如：跨境电商客服"
                          />
                        </div>
                        <div className="field">
                          <label>备注</label>
                          <input
                            value={candidate.notes}
                            onChange={(event) => updateDraft(candidate.id, { notes: event.target.value })}
                            placeholder="为什么值得讨论"
                          />
                        </div>
                      </div>
                      <div className="field-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                        <div className="field">
                          <label>从</label>
                          <textarea
                            value={candidate.routeFrom}
                            onChange={(event) => updateDraft(candidate.id, { routeFrom: event.target.value })}
                            placeholder="触发源 / 输入信号"
                          />
                        </div>
                        <div className="field">
                          <label>到</label>
                          <textarea
                            value={candidate.routeTo}
                            onChange={(event) => updateDraft(candidate.id, { routeTo: event.target.value })}
                            placeholder="输出结果 / 交付物"
                          />
                        </div>
                        <div className="field">
                          <label>AI 做什么</label>
                          <textarea
                            value={candidate.aiWork}
                            onChange={(event) => updateDraft(candidate.id, { aiWork: event.target.value })}
                            placeholder="AI 负责什么"
                          />
                        </div>
                        <div className="field">
                          <label>人做什么</label>
                          <textarea
                            value={candidate.humanWork}
                            onChange={(event) => updateDraft(candidate.id, { humanWork: event.target.value })}
                            placeholder="人负责什么"
                          />
                        </div>
                        <div className="field">
                          <label>成功标准</label>
                          <textarea
                            value={candidate.successStandard}
                            onChange={(event) => updateDraft(candidate.id, { successStandard: event.target.value })}
                            placeholder="4-6 周内看见什么结果"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="summary-box">
                    <p className="muted">还没有候选。先输入关键提示词并生成三条备选回路。</p>
                  </div>
                )}
                <button className="solid-btn" disabled={!canCreate || eventBusy} onClick={() => void createEvent()} type="button">
                  {eventBusy ? "正在创建…" : "用这 3 条候选创建活动"} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="recent">
          <div className="card">
            <div className="section-title">
              <p className="eyebrow">RECENT EVENTS</p>
              <h2>最近创建的活动</h2>
            </div>
            <div className="stack" style={{ marginTop: 16 }}>
              {recentEvents.length ? (
                recentEvents.map((event) => (
                  <div key={event.id} className="summary-box">
                    <div className="label">{event.venue}</div>
                    <strong>{event.title}</strong>
                    <p className="muted" style={{ marginTop: 8 }}>
                      {event.tagline}
                    </p>
                    <div className="hero-actions" style={{ marginTop: 12 }}>
                      <a className="chip" href={joinAppPath(`/e/${event.id}`)}>
                        参与者页
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">还没有创建活动。先生成一个入口。</p>
              )}
            </div>
          </div>
        </section>

        <div className="footer-note">
          这个前台只做一件事：把关键提示词变成 3 条可编辑的业务回路，并把它们锁进扫码可进入的现场流程里。
        </div>
      </main>
    </div>
  );
}
