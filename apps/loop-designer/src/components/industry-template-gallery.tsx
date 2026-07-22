"use client";

import { useMemo, useState } from "react";
import type { IndustryLoopTemplateSummary } from "@/lib/industry-loop-template-types";
import { NewSessionButton } from "./new-session-button";

export function IndustryTemplateGallery({ templates }: { templates: IndustryLoopTemplateSummary[] }) {
  const industries = useMemo(() => ["全部", ...Array.from(new Set(templates.map((item) => item.industry)))], [templates]);
  const [industry, setIndustry] = useState("全部");
  const visible = industry === "全部" ? templates : templates.filter((item) => item.industry === industry);

  return (
    <section className="mx-auto max-w-7xl border-t border-white/10 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mono mb-3 text-[10px] tracking-[.2em] text-[var(--acid)]">INDUSTRY LOOP TEMPLATES</div>
          <h2 className="text-3xl font-black tracking-[-.03em]">从高价值行业回路开始</h2>
          <p className="mt-3 max-w-2xl leading-7 text-white/52">
            模板只作为参考锚点。系统仍会要求你输入真实价值流、角色、接口和治理约束。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {industries.map((item) => (
            <button
              key={item}
              onClick={() => setIndustry(item)}
              className={`border px-3 py-2 text-sm ${industry === item ? "border-[var(--acid)] text-[var(--acid)]" : "border-white/12 text-white/45 hover:border-white/35"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visible.map((template) => (
          <article key={template.id} className="panel flex min-h-80 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="mono text-[10px] tracking-[.16em] text-[var(--cyan)]">{template.industry}</span>
              <span className="mono text-[10px] text-[var(--acid)]">{template.marginalEffectRating || "未评分"}</span>
            </div>
            <h3 className="mt-4 text-xl font-black leading-tight">{template.title}</h3>
            {template.pathType ? <div className="mono mt-2 text-[10px] text-white/35">{template.pathType}</div> : null}
            <p className="mt-4 line-clamp-4 text-sm leading-6 text-white/58">{template.definition || template.applicableScenarios}</p>
            <p className="mt-4 line-clamp-3 border-t border-white/10 pt-4 text-xs leading-5 text-white/38">{template.tradeoffs || template.applicableScenarios}</p>
            <div className="mt-auto pt-5">
              <NewSessionButton
                templateId={template.id}
                label="用此模板开始"
                className="inline-flex w-full items-center justify-center gap-2 border border-[var(--acid)] px-4 py-3 text-sm font-bold text-[var(--acid)] hover:bg-[var(--acid)] hover:text-black disabled:opacity-50"
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
