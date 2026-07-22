"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, Container, GlassCard, SectionLabel } from "@/components/ui";
import { buildReport, demoParticipant } from "@/lib/assessment/scoring";
import { orderedModules, questions, moduleMeta } from "@/lib/assessment/questions";
import { saveLocalReport } from "@/lib/assessment/storage";
import type { AssessmentAnswers, ParticipantProfile, StageAnswer } from "@/lib/assessment/types";

async function submitAssessment(payload: Record<string, unknown>) {
  const res = await fetch("/book/api/assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

const scaleLabels = ["完全不符合", "较少符合", "部分符合", "比较符合", "稳定符合"];
const stageOptions: { value: StageAnswer; label: string }[] = [
  { value: "not_yet", label: "尚未发生" },
  { value: "occasional", label: "偶尔发生" },
  { value: "stable", label: "已稳定发生" },
];

export default function AssessmentPage() {
  const params = useParams<{ eventSlug: string }>();
  const router = useRouter();
  const [moduleIndex, setModuleIndex] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const currentModule = orderedModules[moduleIndex];

  const currentQuestions = useMemo(
    () => questions.filter((question) => question.module === currentModule).sort((a, b) => a.sortOrder - b.sortOrder),
    [currentModule],
  );

  const progress = Math.round(((moduleIndex + 1) / orderedModules.length) * 100);
  const isLast = moduleIndex === orderedModules.length - 1;

  function updateAnswer(id: string, value: string | number) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function moduleComplete() {
    return currentQuestions.every((question) => {
      const value = answers[question.id];
      if (question.type === "text") return typeof value === "string" && value.trim().length > 0;
      return value !== undefined && value !== "";
    });
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    const rawProfile = sessionStorage.getItem(`profile:${params.eventSlug}`);
    const participant: ParticipantProfile = rawProfile ? JSON.parse(rawProfile) : demoParticipant;
    const report = buildReport(params.eventSlug, participant, answers);
    const accessCode = sessionStorage.getItem(`access:${params.eventSlug}`) ?? undefined;
    const remoteResult = await submitAssessment({ eventSlug: params.eventSlug, participant, answers, report, accessCode });
    setSubmitting(false);

    if (!remoteResult.ok) {
      setSubmitError(remoteResult.reason || "提交失败，请稍后重试。");
      return;
    }

    saveLocalReport(report);
    router.push(`/report/${remoteResult.reportId}`);
  }

  return (
    <AppShell>
      <Container className="max-w-5xl py-10">
        <div className="mb-8">
          <SectionLabel>Step 2 / 核心测评</SectionLabel>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-black text-white">{moduleMeta[currentModule].title}</h1>
              <p className="mt-3 text-emerald-50/65">{moduleMeta[currentModule].description}</p>
            </div>
            <div className="text-sm font-bold text-emerald-200">{progress}%</div>
          </div>
          <div className="mt-5 h-2 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <GlassCard className="p-6">
          <div className="grid gap-5">
            {currentQuestions.map((question) => (
              <div key={question.id} className="rounded-3xl border border-emerald-200/10 bg-black/20 p-5">
                <div className="text-base font-bold leading-7 text-white">{question.title}</div>
                {question.description ? <p className="mt-2 text-sm text-emerald-50/55">{question.description}</p> : null}

                {question.type === "stage" ? (
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {stageOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateAnswer(question.id, option.value)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                          answers[question.id] === option.value
                            ? "border-emerald-300 bg-emerald-300 text-[#06110f]"
                            : "border-emerald-200/15 bg-white/[0.045] text-emerald-50/70 hover:bg-white/10"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {question.type === "scale" ? (
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateAnswer(question.id, value)}
                        className={`rounded-2xl border px-2 py-3 text-center transition ${
                          answers[question.id] === value
                            ? "border-emerald-300 bg-emerald-300 text-[#06110f]"
                            : "border-emerald-200/15 bg-white/[0.045] text-emerald-50/70 hover:bg-white/10"
                        }`}
                      >
                        <span className="block text-lg font-black">{value}</span>
                        <span className="hidden text-[11px] leading-4 md:block">{scaleLabels[value - 1]}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {question.type === "text" ? (
                  <textarea
                    className="mt-4 min-h-28 w-full rounded-2xl border border-emerald-200/15 bg-black/30 p-4 text-sm leading-7 text-white outline-none transition placeholder:text-emerald-50/30 focus:border-emerald-300"
                    value={(answers[question.id] as string | undefined) ?? ""}
                    onChange={(event) => updateAnswer(question.id, event.target.value)}
                    placeholder="请写真实现场，避免公司敏感信息。"
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between gap-3">
            <button
              type="button"
              disabled={moduleIndex === 0}
              onClick={() => setModuleIndex((index) => Math.max(0, index - 1))}
              className="rounded-full border border-emerald-200/20 px-5 py-3 text-sm font-bold text-emerald-50/80 disabled:cursor-not-allowed disabled:opacity-35"
            >
              上一步
            </button>
            {isLast ? (
              <button
                type="button"
                disabled={!moduleComplete() || submitting}
                onClick={submit}
                className="rounded-full bg-emerald-300 px-6 py-3 text-sm font-black text-[#06110f] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {submitting ? "生成报告中..." : "提交并生成报告"}
              </button>
            ) : (
              <button
                type="button"
                disabled={!moduleComplete()}
                onClick={() => setModuleIndex((index) => Math.min(orderedModules.length - 1, index + 1))}
                className="rounded-full bg-emerald-300 px-6 py-3 text-sm font-black text-[#06110f] disabled:cursor-not-allowed disabled:opacity-45"
              >
                下一步
              </button>
            )}
          </div>
          {submitError ? (
            <div className="mt-5 rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm text-red-100">
              {submitError.includes("登录") ? (
                <>
                  {submitError} 请返回登录后重新提交。
                </>
              ) : (
                submitError
              )}
            </div>
          ) : null}
        </GlassCard>
      </Container>
    </AppShell>
  );
}
