"use client";

import type { QuestionDistribution } from "@/lib/assessment/types";

const moduleTitles: Record<string, string> = {
  stage: "五级阶梯",
  spiral: "三螺旋",
  energy: "意义-权力-信任",
  chain: "人机链路准备度",
  charter: "AI 宪章准备度",
};

const moduleDescriptions: Record<string, string> = {
  stage: "判断组织 AI 转型的当前阶段和进展速度",
  spiral: "诊断结构、细胞、环境三个层面的适配程度",
  energy: "识别意义、权力、信任三个隐性能量卡点",
  chain: "评估人机协作流程的实验准备度",
  charter: "评估 AI 治理框架的清晰度",
};

const moduleIcons: Record<string, string> = {
  stage: "📊",
  spiral: "🌀",
  energy: "⚡",
  chain: "🔗",
  charter: "📜",
};

const scaleBuckets = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

const stageBuckets = [
  { value: 1, label: "尚未" },
  { value: 3, label: "偶尔" },
  { value: 5, label: "稳定" },
];

export function QuestionDistributions({ distributions }: { distributions: QuestionDistribution[] }) {
  const grouped = distributions.reduce<Record<string, QuestionDistribution[]>>((acc, dist) => {
    if (!acc[dist.module]) acc[dist.module] = [];
    acc[dist.module].push(dist);
    return acc;
  }, {});

  const moduleOrder = ["stage", "spiral", "energy", "chain", "charter"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">各问题数据分布</h2>
          <p className="mt-2 text-sm text-emerald-50/60">基于所有有效回复的回答分布，用于现场解读和讨论</p>
        </div>
      </div>

      {moduleOrder
        .filter((module) => grouped[module]?.length)
        .map((module) => (
          <div key={module} className="rounded-3xl border border-emerald-200/15 bg-[#0c201c]/75 p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{moduleIcons[module]}</span>
                  <div>
                    <h3 className="text-xl font-black text-white">{moduleTitles[module]}</h3>
                    <p className="mt-1 text-sm text-emerald-50/60">{moduleDescriptions[module]}</p>
                  </div>
                </div>
              </div>
              <ModuleAverageScore questions={grouped[module]} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {grouped[module].map((q, index) => (
                <QuestionDistributionCard key={q.questionId} question={q} rank={index + 1} />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function ModuleAverageScore({ questions }: { questions: QuestionDistribution[] }) {
  const avg = questions.reduce((sum, q) => sum + q.averageScore, 0) / questions.length;

  const colorClass =
    avg >= 4 ? "text-emerald-300" : avg >= 3 ? "text-yellow-300" : avg >= 2 ? "text-orange-300" : "text-red-300";

  return (
    <div className="text-right">
      <div className="text-sm text-emerald-50/60">模块均分</div>
      <div className={`text-3xl font-black ${colorClass}`}>{avg.toFixed(2)}</div>
    </div>
  );
}

function QuestionDistributionCard({ question, rank }: { question: QuestionDistribution; rank: number }) {
  const maxCount = Math.max(...Object.values(question.distribution), 1);
  const hasOutliers = question.outliers.length > 0;
  const buckets = question.module === "stage" ? stageBuckets : scaleBuckets;

  return (
    <div
      className={`rounded-2xl border bg-black/20 p-5 ${
        hasOutliers ? "border-yellow-300/30 bg-yellow-300/5" : "border-emerald-200/12"
      }`}
    >
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-300/20 text-xs font-black text-emerald-200">
          {rank}
        </span>
        <div className="flex-1">
          <h4 className="text-base font-black leading-7 text-white">{question.questionText}</h4>
          {question.dimension ? (
            <div className="mt-1 text-xs text-emerald-50/50">
              {moduleTitles[question.module]} · {question.dimension}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <ScoreBadge score={question.averageScore} />
          {hasOutliers && (
            <span className="rounded-full bg-yellow-300/15 px-2 py-0.5 text-[10px] font-bold text-yellow-200">注意</span>
          )}
        </div>
      </div>

      {/* Distribution bars */}
      <div className="mt-4 space-y-2">
        {buckets.map(({ value, label }) => {
          const count = question.distribution[String(value)] ?? 0;
          const barWidth = (count / maxCount) * 100;

          return (
            <div key={value} className="flex items-center gap-3">
              <div className="w-8 flex-shrink-0 text-right text-xs font-bold text-emerald-50/60">{label}</div>
              <div className="flex-1">
                <div className="relative h-4 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`absolute left-0 top-0 h-full transition-all ${
                      value <= 2 ? "bg-red-400/60" : value === 3 ? "bg-yellow-400/60" : "bg-emerald-400/60"
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
              <div className="w-12 flex-shrink-0 text-right text-xs text-emerald-50/50">
                {count > 0 ? `${count}人` : "-"}
              </div>
            </div>
          );
        })}
      </div>

      {hasOutliers && (
        <div className="mt-3 rounded-lg border border-yellow-300/20 bg-yellow-300/10 p-3">
          <p className="text-xs text-yellow-200">{question.outliers[0]}</p>
        </div>
      )}

      {/* Outlier indicator */}
      {question.averageScore >= 4 && (
        <div className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
          <p className="text-xs text-emerald-200">✓ 群体在此问题上表现较强</p>
        </div>
      )}
      {question.averageScore <= 2 && !hasOutliers && (
        <div className="mt-3 rounded-lg border border-red-300/20 bg-red-300/10 p-3">
          <p className="text-xs text-red-200">⚠ 群体在此问题上普遍较弱，需要关注</p>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const colorClass =
    score >= 4 ? "bg-emerald-500/20 text-emerald-300" : score >= 3 ? "bg-yellow-500/20 text-yellow-300" : score >= 2 ? "bg-orange-500/20 text-orange-300" : "bg-red-500/20 text-red-300";

  return (
    <div className={`rounded-lg px-2 py-1 text-lg font-black ${colorClass}`}>
      {score.toFixed(1)}
    </div>
  );
}
