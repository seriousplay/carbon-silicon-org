import { notFound } from "next/navigation";
import { CheckCircle2, MessageSquareText, Sparkles } from "lucide-react";
import { AppShell, Container, GlassCard, SectionLabel } from "@/components/ui";
import { getAssessmentRun } from "@/lib/runs/server";
import { FeedbackForm } from "./feedback-form";

export default async function WorkshopFeedbackPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  const run = await getAssessmentRun(eventSlug);

  if (!run || !["active", "draft"].includes(run.status)) {
    notFound();
  }

  return (
    <AppShell>
      <Container className="max-w-6xl py-10">
        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <SectionLabel>Final Feedback</SectionLabel>
            <h1 className="text-4xl font-black leading-tight text-white md:text-5xl">方法论体检</h1>
            <p className="mt-5 text-lg leading-9 text-emerald-50/68">
              这不是课后满意度表。请帮我们判断：哪些框架真正有用，哪些概念听懂了但难用，哪些词需要重新命名。
            </p>

            <div className="mt-8 grid gap-4">
              {[
                ["最有用", "哪个框架最能解释你的组织现场？"],
                ["最难用", "哪个框架听懂了，但回去不知道如何落地？"],
                ["最该改名", "哪个词或模型会影响传播和理解？"],
              ].map(([title, text]) => (
                <GlassCard key={title} className="p-5">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-300" />
                    <div>
                      <h2 className="font-black text-white">{title}</h2>
                      <p className="mt-1 text-sm leading-6 text-emerald-50/58">{text}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          <GlassCard className="overflow-hidden p-0">
            <div className="border-b border-emerald-200/10 bg-white/[0.035] p-6">
              <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-emerald-100/70">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-300/12 px-3 py-1.5 text-emerald-200">
                  <Sparkles className="h-4 w-4" />
                  {run.title}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-3 py-1.5">
                  <MessageSquareText className="h-4 w-4" />
                  匿名提交，只看群体反馈
                </span>
              </div>
            </div>
            <FeedbackForm eventSlug={eventSlug} />
          </GlassCard>
        </div>
      </Container>
    </AppShell>
  );
}
