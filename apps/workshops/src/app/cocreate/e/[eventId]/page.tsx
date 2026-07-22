"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Copy, Save, Target } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { joinAppPath } from "@/lib/config";
import { computeCandidateRank, computeWeightedScore } from "@/lib/shared";
import type { CandidateRecord, EventRecord, SessionRecord } from "@/lib/types";

const exampleCandidates = [
  {
    name: "止损回路",
    scenario: "跨境电商客服",
    routeFrom: "从客户投诉工单和低分标签触达",
    routeTo: "到 48 小时内输出个性化解决方案",
    aiWork: "自动聚合投诉、总结相似问题、建议优先处置路径。",
    humanWork: "确认赔付策略、处理例外和高风险客户。",
    successStandard: "48 小时内响应提速，投诉复发率下降。",
    source: "模板" as const,
    notes: "优先抓高频投诉。",
  },
  {
    name: "数据回路",
    scenario: "SaaS 续费预警",
    routeFrom: "从续费前 30 天的使用衰减信号",
    routeTo: "到输出优先挽回名单和话术建议",
    aiWork: "自动识别流失信号、排序风险账户、生成建议话术。",
    humanWork: "判断挽回优先级、决定是否联系和怎么联系。",
    successStandard: "4 周内挽回名单可执行，续费流失率下降。",
    source: "模板" as const,
    notes: "看自然流失风险。",
  },
  {
    name: "推进回路",
    scenario: "制造质检",
    routeFrom: "从产线传感器和视觉检测信号采集",
    routeTo: "到输出提前预警和备件建议",
    aiWork: "自动识别异常波动、提前推送预警和备件建议。",
    humanWork: "确认停线/检修决策、协调现场资源。",
    successStandard: "提前预警周期拉长，停线损失下降。",
    source: "模板" as const,
    notes: "适合短闭环。",
  },
];

export default function EventPage() {
  const params = useParams<{ eventId: string }>();
  const searchParams = useSearchParams();
  const eventId = params.eventId;
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [nickname, setNickname] = useState("");
  const [company, setCompany] = useState("");
  const [seat, setSeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    void fetch(`/field-cocreation/api/events/${eventId}`)
      .then((response) => response.json())
      .then((data: { event?: EventRecord; error?: string }) => {
        if (data.event) {
          setEvent(data.event);
        } else {
          setError(data.error || "活动不存在");
        }
      })
      .catch(() => setError("无法加载活动"));
  }, [eventId]);

  const topCandidates = useMemo(() => {
    if (!session) return [];
    return [...session.candidates]
      .sort((left, right) => computeCandidateRank(right) - computeCandidateRank(left))
      .slice(0, 2);
  }, [session]);

  const finalChoice = useMemo(() => {
    if (!session || !session.finalChoiceId) return null;
    return session.candidates.find((candidate) => candidate.id === session.finalChoiceId) ?? null;
  }, [session]);

  async function createSession() {
    if (!eventId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/field-cocreation/api/events/${eventId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, company, seat }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "创建会话失败");
        return;
      }
      setSession(data.session as SessionRecord);
      window.history.replaceState(null, "", joinAppPath(`/e/${eventId}?sid=${data.session.id}`));
    } catch {
      setError("网络请求失败");
    } finally {
      setBusy(false);
    }
  }

  async function persist(next: SessionRecord) {
    setSession(next);
    await fetch(`/field-cocreation/api/sessions/${next.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: next }),
    });
  }

  useEffect(() => {
    if (!eventId) return;
    const sid = searchParams.get("sid");
    if (sid) {
      void fetch(`/field-cocreation/api/sessions/${sid}?eventId=${eventId}`)
        .then((response) => response.json().then((data) => ({ response, data })))
        .then(({ response, data }: { response: Response; data: { session?: SessionRecord } }) => {
          if (response.ok && data.session) {
            setSession(data.session);
            setNickname(data.session.participant.nickname);
            setCompany(data.session.participant.company);
            setSeat(data.session.participant.seat);
          }
        })
        .catch(() => undefined);
    }
  }, [eventId, searchParams]);

  function updateCandidate(candidateId: string, patch: Partial<CandidateRecord>) {
    if (!session) return;
    const next = {
      ...session,
      status: "active" as const,
      candidates: session.candidates.map((candidate) => {
        if (candidate.id !== candidateId) return candidate;
        const merged = { ...candidate, ...patch };
        if (patch.flags) {
          return { ...merged, scores: computeWeightedScore(patch.flags) };
        }
        return merged;
      }),
    };
    void persist(next);
  }

  function updateSessionField(patch: Partial<SessionRecord>) {
    if (!session) return;
    void persist({ ...session, ...patch });
  }

  function loadExamples() {
    if (!session) return;
    const next = {
      ...session,
      candidates: session.candidates.map((candidate, index) => ({
        ...candidate,
        ...exampleCandidates[index],
      })),
    };
    void persist(next);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
  }

  if (error && !event) {
    return (
      <div className="app-shell">
        <div className="grain" aria-hidden="true" />
        <main className="shell" style={{ padding: 40 }}>
          <div className="card">
            <p className="eyebrow">FIELD SESSION</p>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(36px, 6vw, 72px)", margin: "10px 0" }}>活动加载失败</h1>
            <p className="muted">{error}</p>
            <a className="solid-btn" href={joinAppPath("/")}>返回首页</a>
          </div>
        </main>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="app-shell">
        <div className="grain" aria-hidden="true" />
        <main className="shell" style={{ padding: 40 }}>
          <div className="card">加载中…</div>
        </main>
      </div>
    );
  }

  const readyToScore = session ? topCandidates : [];

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />
      <header className="shell topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span>场</span></div>
          <div>
            <small>{event.venue}</small>
            <strong>{event.title}</strong>
          </div>
        </div>
        <div className="top-links">
          <button className="chip" onClick={copyLink}><Copy size={14} /> 复制当前链接</button>
          <a className="chip" href={joinAppPath(`/admin/${event.id}`)}>讲师看板</a>
        </div>
      </header>

      <main className="shell">
      <section className="hero" style={{ paddingTop: 28 }}>
          <div className="hero-copy">
            <p className="eyebrow">PARTICIPANT / 02</p>
            <h1>先把自己的 3 条回路写出来，再做筛选。</h1>
            <p>{event.tagline}</p>
            <div className="hero-actions">
              <button className="ghost-btn" onClick={loadExamples} type="button">
                <Target size={16} /> 填入示例
              </button>
              <button className="ghost-btn" onClick={() => session && updateSessionField({ step: Math.max(session.step - 1, 0) })} type="button">
                <ArrowRight size={16} style={{ transform: "rotate(180deg)" }} /> 返回上一步
              </button>
            </div>
          </div>

          <aside className="hero-panel">
            <div className="panel-title">
              <h2>参与者信息</h2>
              <p>{session ? `会话 ${session.id.slice(-6)}` : "未开始"}</p>
            </div>
            {session ? (
              <div className="summary-grid" style={{ marginTop: 16 }}>
                <div className="summary-box">
                  <div className="label">姓名</div>
                  <strong>{session.participant.nickname || "未填写"}</strong>
                </div>
                <div className="summary-box">
                  <div className="label">公司</div>
                  <strong>{session.participant.company || "未填写"}</strong>
                </div>
                <div className="summary-box">
                  <div className="label">位置</div>
                  <strong>{session.participant.seat || "未填写"}</strong>
                </div>
              </div>
            ) : (
              <div className="stack" style={{ marginTop: 16 }}>
                <div className="field-grid">
                  <div className="field">
                    <label>昵称</label>
                    <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="你的称呼" />
                  </div>
                  <div className="field">
                    <label>公司 / 组织</label>
                    <input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="可选" />
                  </div>
                  <div className="field">
                    <label>座位 / 分组</label>
                    <input value={seat} onChange={(event) => setSeat(event.target.value)} placeholder="可选" />
                  </div>
                </div>
                <button className="solid-btn" onClick={createSession} disabled={busy} type="button">
                  {busy ? "正在进入…" : "进入现场流程"} <ArrowRight size={16} />
                </button>
                {error ? <p className="muted" style={{ color: "var(--danger)" }}>{error}</p> : null}
              </div>
            )}
          </aside>
        </section>

        {session ? (
          <section className="section workflow">
            <aside className="rail">
              {[
                "1. 写 3 条候选",
                "2. 四标准快筛",
                "3. 加权评分",
                "4. 压力测试",
                "5. 锁定动作",
              ].map((label, index) => (
                <div key={label} className={`rail-step ${session.step === index ? "active" : session.step > index ? "done" : ""}`}>
                  <b>{label}</b>
                  <span>{session.step === index ? "进行中" : session.step > index ? "已完成" : "待处理"}</span>
                </div>
              ))}
            </aside>

            <div className="stack">
              <div className="card step-card">
                <div className="section-title">
                  <p className="eyebrow">STEP 1</p>
                  <h2>写 3 条候选回路</h2>
                </div>
                <div className="candidate-list">
                  {session.candidates.map((candidate, index) => (
                    <div key={candidate.id} className="candidate-card">
                      <div className="candidate-head">
                        <strong>候选 {index + 1}</strong>
                        <span className="chip">{candidate.source}</span>
                      </div>
                      <div className="mini-row">
                        <div className="field">
                          <label>名称</label>
                          <input value={candidate.name || ""} onChange={(event) => updateCandidate(candidate.id, { name: event.target.value })} placeholder="例如：止损回路" />
                        </div>
                        <div className="field">
                          <label>场景</label>
                          <input value={candidate.scenario} onChange={(event) => updateCandidate(candidate.id, { scenario: event.target.value })} placeholder="例如：跨境电商客服" />
                        </div>
                      </div>
                      <div className="mini-row">
                        <div className="field">
                          <label>从</label>
                          <input value={candidate.routeFrom} onChange={(event) => updateCandidate(candidate.id, { routeFrom: event.target.value })} placeholder="触发源 / 数据入口" />
                        </div>
                        <div className="field">
                          <label>到</label>
                          <input value={candidate.routeTo} onChange={(event) => updateCandidate(candidate.id, { routeTo: event.target.value })} placeholder="交付物 / 业务结果" />
                        </div>
                        <div className="field">
                          <label>备注</label>
                          <textarea value={candidate.notes} onChange={(event) => updateCandidate(candidate.id, { notes: event.target.value })} placeholder="这条为什么有可能成立？" />
                        </div>
                      </div>
                      <div className="summary-grid">
                        <div className="summary-box">
                          <div className="label">AI 做什么</div>
                          <strong>{candidate.aiWork || "待填写"}</strong>
                        </div>
                        <div className="summary-box">
                          <div className="label">人做什么</div>
                          <strong>{candidate.humanWork || "待填写"}</strong>
                        </div>
                        <div className="summary-box">
                          <div className="label">成功标准</div>
                          <strong>{candidate.successStandard || "待填写"}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="solid-btn" onClick={() => updateSessionField({ step: 1, status: "active" })} type="button">
                  去做四标准快筛 <ArrowRight size={16} />
                </button>
              </div>

              <div className="card step-card">
                <div className="section-title">
                  <p className="eyebrow">STEP 2</p>
                  <h2>四标准快筛</h2>
                </div>
                <div className="candidate-list">
                  {session.candidates.map((candidate) => (
                    <div key={candidate.id} className="candidate-card">
                      <div className="candidate-head">
                        <strong>{candidate.name || candidate.scenario || "未命名候选"}</strong>
                        <span className="muted">{candidate.scenario || "未填写场景"}</span>
                        <span className="muted">{candidate.routeFrom || "从…" } → {candidate.routeTo || "到…"}</span>
                      </div>
                      <div className="mini-matrix">
                        {[
                          ["pain", "真痛点"],
                          ["data", "有数据"],
                          ["owner", "有人扛"],
                          ["shortLoop", "闭环短"],
                        ].map(([key, label]) => (
                          <label className="check" key={key}>
                            <input
                              type="checkbox"
                              checked={candidate.flags[key as keyof typeof candidate.flags]}
                              onChange={(event) => updateCandidate(candidate.id, { flags: { ...candidate.flags, [key]: event.target.checked } })}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button className="solid-btn" onClick={() => updateSessionField({ step: 2, status: "active" })} type="button">
                  进入加权评分 <ArrowRight size={16} />
                </button>
              </div>

              <div className="card step-card">
                <div className="section-title">
                  <p className="eyebrow">STEP 3</p>
                  <h2>加权评分，自动筛出前两条</h2>
                </div>
                <div className="candidate-list">
                  {readyToScore.map((candidate) => (
                    <div key={candidate.id} className="candidate-card">
                      <div className="candidate-head">
                        <strong>{candidate.name || candidate.scenario || "未命名候选"}</strong>
                        <span className="chip">四项命中 {computeCandidateRank(candidate)} / 4</span>
                      </div>
                      <div className="score-grid">
                        {[
                          ["pain", "痛点清晰", candidate.scores.pain],
                          ["data", "数据可得", candidate.scores.data],
                          ["copy", "复制潜力", candidate.scores.copy],
                          ["risk", "风险可控", candidate.scores.risk],
                        ].map(([key, label, value]) => (
                          <label className="field" key={key}>
                            <span className="label">{label}</span>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={value}
                              onChange={(event) => {
                                const nextValue = Number(event.target.value || 0);
                                const nextScores = { ...candidate.scores, [key]: nextValue };
                                nextScores.total = nextScores.pain * 0.4 + nextScores.data * 0.3 + nextScores.copy * 0.2 + nextScores.risk * 0.1;
                                updateCandidate(candidate.id, { scores: nextScores });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      <p className="muted">总分：{candidate.scores.total.toFixed(1)}</p>
                    </div>
                  ))}
                </div>
                <button className="solid-btn" onClick={() => updateSessionField({ step: 3, status: "active", finalChoiceId: readyToScore[0]?.id ?? null })} type="button">
                  进入压力测试 <ArrowRight size={16} />
                </button>
              </div>

              <div className="card step-card">
                <div className="section-title">
                  <p className="eyebrow">STEP 4</p>
                  <h2>同伴压力测试</h2>
                </div>
                <div className="stack">
                  <div className="field">
                    <label>追问你的人</label>
                    <input value={session.pressure.challenger} onChange={(event) => updateSessionField({ pressure: { ...session.pressure, challenger: event.target.value } })} placeholder="旁边那位 / 不同行业的人" />
                  </div>
                  <div className="field">
                    <label>发现的盲区</label>
                    <textarea value={session.pressure.blindspot} onChange={(event) => updateSessionField({ pressure: { ...session.pressure, blindspot: event.target.value } })} placeholder="他问了什么，让你开始重新看这条回路？" />
                  </div>
                  <div className="field-grid">
                    <div className="field">
                      <label>失败原因</label>
                      <textarea value={session.pressure.failureReason} onChange={(event) => updateSessionField({ pressure: { ...session.pressure, failureReason: event.target.value } })} placeholder="如果失败，最可能卡在哪？" />
                    </div>
                    <div className="field">
                      <label>谁会反对</label>
                      <textarea value={session.pressure.resistance} onChange={(event) => updateSessionField({ pressure: { ...session.pressure, resistance: event.target.value } })} placeholder="谁会阻挡这条回路？" />
                    </div>
                    <div className="field">
                      <label>下周动作</label>
                      <textarea value={session.commitment.action} onChange={(event) => updateSessionField({ commitment: { ...session.commitment, action: event.target.value } })} placeholder="回去第一件事做什么？" />
                    </div>
                  </div>
                </div>
                <button className="solid-btn" onClick={() => updateSessionField({ step: 4, status: "locked" })} type="button">
                  锁定并提交 <CheckCircle2 size={16} />
                </button>
              </div>

              <div className="card step-card">
                <div className="section-title">
                  <p className="eyebrow">STEP 5</p>
                  <h2>最终锁定</h2>
                </div>
                <div className="summary-grid">
                  <div className="summary-box">
                    <div className="label">最终选定</div>
                    <strong>{finalChoice?.name || finalChoice?.scenario || "尚未确定"}</strong>
                  </div>
                  <div className="summary-box">
                    <div className="label">下周动作</div>
                    <strong>{session.commitment.action || "尚未填写"}</strong>
                  </div>
                  <div className="summary-box">
                    <div className="label">第一联系人</div>
                    <strong>{session.commitment.firstContact || "尚未填写"}</strong>
                  </div>
                </div>
                <div className="field-grid">
                  <div className="field">
                    <label>截止时间</label>
                    <input value={session.commitment.deadline} onChange={(event) => updateSessionField({ commitment: { ...session.commitment, deadline: event.target.value } })} placeholder="例如：下周三 18:00" />
                  </div>
                  <div className="field">
                    <label>第一联系人</label>
                    <input value={session.commitment.firstContact} onChange={(event) => updateSessionField({ commitment: { ...session.commitment, firstContact: event.target.value } })} placeholder="回去先找谁" />
                  </div>
                  <div className="field">
                    <label>保存状态</label>
                    <button className="ghost-btn" onClick={() => updateSessionField({ status: "submitted" })} type="button">
                      <Save size={16} /> 标记完成
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="section">
            <div className="card">
              <p className="muted">填写昵称后即可进入流程。系统会把输入保存到这场活动里。</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
