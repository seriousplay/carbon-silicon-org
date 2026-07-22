"use client";

import { ReactNode, useState } from "react";

export function TacticalMeetingFlow({ health, tensions }: { health: ReactNode; tensions: ReactNode }) {
  const [stage, setStage] = useState<"HEALTH" | "TENSIONS">("HEALTH");
  return <div className="space-y-5"><nav aria-label="战术会议流程" className="grid grid-cols-2 gap-2 rounded-input border border-border bg-muted/30 p-1"><button type="button" onClick={() => setStage("HEALTH")} className={`rounded-input px-3 py-2 text-left text-sm ${stage === "HEALTH" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}><span className="mr-2 text-xs text-muted-foreground">01</span>运营健康度输入与存档</button><button type="button" onClick={() => setStage("TENSIONS")} className={`rounded-input px-3 py-2 text-left text-sm ${stage === "TENSIONS" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}><span className="mr-2 text-xs text-muted-foreground">02</span>张力清单与逐项处理</button></nav><section aria-live="polite">{stage === "HEALTH" ? health : tensions}</section><div className="flex justify-end">{stage === "HEALTH" ? <button type="button" onClick={() => setStage("TENSIONS")} className="text-sm text-moss hover:underline">进入张力清单与处理 →</button> : <button type="button" onClick={() => setStage("HEALTH")} className="text-sm text-moss hover:underline">← 返回运营健康度</button>}</div></div>;
}
