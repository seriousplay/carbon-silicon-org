"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ChevronRight, Check, X, User, Bot, Loader2, ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scaffoldCircuitDesignAction, createCircuitFromDesignAction, type CircuitDesignSuggestion } from "@/app/app/organization/business-loops/circuit-design-actions";

const STEP_LABELS = ["价值定位", "核心指标", "角色节点", "节点协作", "输入输出", "节奏负责人"];
const STEP_QUESTIONS = [
  "这个回路为谁创造什么核心价值？一句话说清楚。",
  "如何判断这个回路在健康运转？需要哪 2-3 个核心指标？（如：交付延迟 < 4h、质量合格率 > 99%）",
  "回路需要哪些角色来运转？可以是人类角色👤，也可以是 AI 智能体🤖。",
  "回路节点之间如何协作？数据/价值/信号如何流动？（如：数据采集→质量巡检→交付）",
  "回路从哪里接收输入？向谁交付输出？验收标准是什么？",
  "回路按什么节奏运转（每周/每两周/持续）？谁来负责这条回路？",
];

type Message = {
  role: "ai" | "user";
  content: string;
  suggestion?: CircuitDesignSuggestion;
};

export function CircuitDesignWizard() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestSuggestion, setLatestSuggestion] = useState<CircuitDesignSuggestion | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const totalSteps = 6;

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: "ai",
        content: `你好！我是业务回路设计助手。我会通过 ${totalSteps} 个步骤帮你设计一条清晰的业务价值回路。\n\n**第 1 步：价值定位**\n${STEP_QUESTIONS[0]}`,
      }]);
    }
  }, [messages.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading || confirmed) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("userInput", trimmed);
      formData.set("step", String(step));
      formData.set("context", JSON.stringify(latestSuggestion ?? {}));

      const result = await scaffoldCircuitDesignAction({}, formData);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (result.suggestion) {
        setLatestSuggestion(result.suggestion);
        const nextStep = result.step ?? step;
        setStep(Math.min(nextStep, totalSteps + 1));

        const s = result.suggestion;
        let aiContent = `✓ 回路「${s.name}」— ${s.purpose}\n\n`;
        if (nextStep <= totalSteps) {
          aiContent += `**第 ${nextStep} 步：${STEP_LABELS[nextStep - 1]}**\n${STEP_QUESTIONS[nextStep - 1]}`;
        } else {
          aiContent += `🎉 设计完成！请在右侧预览面板检查回路结构，确认无误后点击「确认并创建回路」。\n\n如需修改任何内容，点击右侧「编辑」按钮即可调整。`;
        }
        if (s.coreMetrics?.length) {
          aiContent += `\n\n📊 指标：${s.coreMetrics.map((m: { name: string; target: string; unit: string }) => `${m.name}(${m.target}${m.unit})`).join("、")}`;
        }
        if (s.nodes?.length) {
          aiContent += `\n👥 节点：${s.nodes.map((n: { nodeType: string; name: string }) => (n.nodeType === "AI_AGENT" ? "🤖" : "👤") + n.name).join(" · ")}`;
        }

        setMessages((prev) => [...prev, { role: "ai", content: aiContent, suggestion: result.suggestion }]);
      }
    } catch (e) {
      setError("网络异常，请重试。");
    }
    setLoading(false);
  }

  async function handleConfirm() {
    if (!latestSuggestion) return;
    setCreating(true);
    setError(null);
    const result = await createCircuitFromDesignAction(latestSuggestion);
    if (result.error) {
      setError(result.error);
      setCreating(false);
    } else {
      setConfirmed(true);
      if (result.tensionsCreated && result.tensionsCreated > 0) {
        setMessages((prev) => [...prev, {
          role: "ai",
          content: `✅ 回路已创建！\n\n📋 自动提交了 ${result.tensionsCreated} 个治理张力——回路中有角色在组织结构中未找到匹配，已自动提交张力供治理会议处理。\n\n请在追踪看板中查看张力，或重新打开此页面查看回路渲染图。`,
        }]);
      }
      router.refresh();
    }
  }

  function updateSuggestion<K extends keyof CircuitDesignSuggestion>(key: K, value: CircuitDesignSuggestion[K]) {
    if (!latestSuggestion) return;
    setLatestSuggestion({ ...latestSuggestion, [key]: value });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6">
      {/* 左侧：对话面板 */}
      <div className="rounded-card border border-border bg-card flex flex-col h-[620px]">
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {step > totalSteps ? "设计完成 ✓" : `步骤 ${Math.min(step, totalSteps)}/${totalSteps} · ${STEP_LABELS[Math.min(step, totalSteps) - 1]}`}
            </span>
            <span className="text-xs text-moss">{Math.round((Math.min(step, totalSteps) / totalSteps) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-moss rounded-full transition-all duration-500" style={{ width: `${(Math.min(step, totalSteps) / totalSteps) * 100}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "ai" && (
                <div className="shrink-0 w-7 h-7 rounded-full bg-moss/15 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-moss" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-moss text-white" : "bg-muted/60"}`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === "user" && (
                <div className="shrink-0 w-7 h-7 rounded-full bg-moss flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-moss/15 flex items-center justify-center"><Loader2 className="w-4 h-4 text-moss animate-spin" /></div>
              <div className="bg-muted/60 rounded-lg px-4 py-2.5 text-sm text-muted-foreground">AI 思考中…</div>
            </div>
          )}
          {error && <div className="rounded-md bg-urgent-pale border border-urgent/20 px-3 py-2 text-sm text-urgent">{error}</div>}
          <div ref={chatEndRef} />
        </div>

        {!confirmed && step <= totalSteps && (
          <div className="px-5 py-3 border-t border-border flex gap-2">
            <input
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={loading ? "AI 思考中…" : STEP_QUESTIONS[Math.min(step, totalSteps) - 1]}
              disabled={loading}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-moss/30"
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()} size="sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        )}
      </div>

      {/* 右侧：预览 + 编辑 */}
      <div className="rounded-card border border-border bg-card p-5 h-[620px] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-moss" />
            <h3 className="text-sm font-semibold">回路预览</h3>
          </div>
          {latestSuggestion && (
            <button type="button" onClick={() => setEditMode(!editMode)} className="text-xs text-moss hover:underline">
              {editMode ? "完成编辑" : "编辑"}
            </button>
          )}
        </div>

        {!latestSuggestion ? (
          <div className="flex flex-col items-center justify-center h-[520px] text-center">
            <Bot className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">在左侧对话中回答 AI 的问题</p>
            <p className="text-xs text-muted-foreground/70 mt-1">回路结构将在这里实时显示</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 名称 + 目的 */}
            <div className="bg-moss-pale/30 rounded-md p-3">
              {editMode ? (
                <>
                  <input className="w-full text-sm font-semibold bg-white border rounded px-2 py-1 mb-1" value={latestSuggestion.name} onChange={(e) => updateSuggestion("name", e.target.value)} />
                  <input className="w-full text-xs bg-white border rounded px-2 py-1" value={latestSuggestion.purpose} onChange={(e) => updateSuggestion("purpose", e.target.value)} />
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-moss">{latestSuggestion.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{latestSuggestion.purpose}</p>
                </>
              )}
            </div>

            {/* 核心指标 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-muted-foreground">核心指标</p>
                {editMode && <button onClick={() => updateSuggestion("coreMetrics", [...latestSuggestion.coreMetrics, { name: "", target: "", unit: "" }])} className="text-moss"><Plus className="w-3 h-3" /></button>}
              </div>
              <div className="space-y-1">
                {latestSuggestion.coreMetrics.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
                    {editMode ? (
                      <>
                        <input className="flex-1 bg-white border rounded px-1 py-0.5" placeholder="指标名" value={m.name} onChange={(e) => { const arr = [...latestSuggestion.coreMetrics]; arr[i] = { ...m, name: e.target.value }; updateSuggestion("coreMetrics", arr); }} />
                        <input className="w-16 bg-white border rounded px-1 py-0.5" placeholder="目标" value={m.target} onChange={(e) => { const arr = [...latestSuggestion.coreMetrics]; arr[i] = { ...m, target: e.target.value }; updateSuggestion("coreMetrics", arr); }} />
                        <input className="w-10 bg-white border rounded px-1 py-0.5" placeholder="单位" value={m.unit} onChange={(e) => { const arr = [...latestSuggestion.coreMetrics]; arr[i] = { ...m, unit: e.target.value }; updateSuggestion("coreMetrics", arr); }} />
                        <button onClick={() => updateSuggestion("coreMetrics", latestSuggestion.coreMetrics.filter((_, j) => j !== i))} className="text-urgent"><Trash2 className="w-3 h-3" /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1">{m.name}</span>
                        <span className="font-medium">{m.target}{m.unit}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 回路节点 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-muted-foreground">回路节点</p>
                {editMode && <button onClick={() => updateSuggestion("nodes", [...latestSuggestion.nodes, { name: "", nodeType: "HUMAN_ROLE", responsibility: "" }])} className="text-moss"><Plus className="w-3 h-3" /></button>}
              </div>
              <div className="space-y-1.5">
                {latestSuggestion.nodes.map((n, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs bg-muted/40 rounded px-2 py-1.5">
                    {editMode ? (
                      <div className="flex-1 space-y-1">
                        <div className="flex gap-1">
                          <select className="bg-white border rounded px-1 py-0.5 text-xs" value={n.nodeType} onChange={(e) => { const arr = [...latestSuggestion.nodes]; arr[i] = { ...n, nodeType: e.target.value as "HUMAN_ROLE" | "AI_AGENT" }; updateSuggestion("nodes", arr); }}>
                            <option value="HUMAN_ROLE">👤 人类</option>
                            <option value="AI_AGENT">🤖 AI</option>
                          </select>
                          <input className="flex-1 bg-white border rounded px-1 py-0.5" placeholder="节点名" value={n.name} onChange={(e) => { const arr = [...latestSuggestion.nodes]; arr[i] = { ...n, name: e.target.value }; updateSuggestion("nodes", arr); }} />
                          <button onClick={() => updateSuggestion("nodes", latestSuggestion.nodes.filter((_, j) => j !== i))} className="text-urgent shrink-0"><Trash2 className="w-3 h-3" /></button>
                        </div>
                        <input className="w-full bg-white border rounded px-1 py-0.5" placeholder="职责描述" value={n.responsibility} onChange={(e) => { const arr = [...latestSuggestion.nodes]; arr[i] = { ...n, responsibility: e.target.value }; updateSuggestion("nodes", arr); }} />
                      </div>
                    ) : (
                      <>
                        <span>{n.nodeType === "AI_AGENT" ? "🤖" : "👤"}</span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{n.name}</p>
                          <p className="text-muted-foreground truncate">{n.responsibility}</p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 连接 */}
            {latestSuggestion.edges.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">节点连接</p>
                <div className="space-y-1">
                  {latestSuggestion.edges.map((e, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs bg-muted/40 rounded px-2 py-1">
                      <span className="truncate max-w-[80px]">{e.from}</span>
                      <ArrowRight className="w-3 h-3 text-moss shrink-0" />
                      <span className="truncate max-w-[80px]">{e.to}</span>
                      <span className="text-muted-foreground ml-auto shrink-0">{e.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 输入输出 */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/40 rounded p-2">
                <p className="font-medium text-muted-foreground mb-1">输入</p>
                {latestSuggestion.inputs.length === 0 && <p className="text-muted-foreground/60">暂无</p>}
                {latestSuggestion.inputs.map((inp, i) => (
                  <p key={i} className="truncate">{inp.label} ← {inp.source}</p>
                ))}
              </div>
              <div className="bg-muted/40 rounded p-2">
                <p className="font-medium text-muted-foreground mb-1">输出</p>
                {latestSuggestion.outputs.length === 0 && <p className="text-muted-foreground/60">暂无</p>}
                {latestSuggestion.outputs.map((out, i) => (
                  <p key={i} className="truncate">{out.label} → {out.consumer}</p>
                ))}
              </div>
            </div>

            {/* 负责人和节奏 */}
            <div className="bg-muted/40 rounded p-2 text-xs space-y-1">
              {editMode ? (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground shrink-0">负责人：</span>
                    <input className="flex-1 bg-white border rounded px-1 py-0.5" value={latestSuggestion.leadSuggestion} onChange={(e) => updateSuggestion("leadSuggestion", e.target.value)} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground shrink-0">节奏：</span>
                    <select className="bg-white border rounded px-1 py-0.5" value={latestSuggestion.cadence} onChange={(e) => updateSuggestion("cadence", e.target.value)}>
                      <option value="WEEKLY">每周</option><option value="BIWEEKLY">每两周</option><option value="MONTHLY">每月</option><option value="CONTINUOUS">持续运转</option>
                    </select>
                    <input className="flex-1 bg-white border rounded px-1 py-0.5" placeholder="具体描述" value={latestSuggestion.cadenceDetail || ""} onChange={(e) => updateSuggestion("cadenceDetail", e.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <p><span className="text-muted-foreground">负责人：</span>{latestSuggestion.leadSuggestion || "待指定"}</p>
                  <p><span className="text-muted-foreground">节奏：</span>{latestSuggestion.cadenceDetail || latestSuggestion.cadence || "待指定"}</p>
                </>
              )}
            </div>

            {/* 确认按钮 */}
            {step > totalSteps && !confirmed && (
              <div className="flex gap-2 pt-2">
                <Button onClick={handleConfirm} disabled={creating} className="flex-1" size="sm">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                  {creating ? "创建中…" : "确认并创建回路"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setStep(1); setLatestSuggestion(null); setMessages([]); setEditMode(false); }}>
                  <X className="w-4 h-4 mr-1" />重新设计
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
