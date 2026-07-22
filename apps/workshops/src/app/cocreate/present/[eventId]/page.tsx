import { notFound } from "next/navigation";
import { Activity, ShieldCheck, Target, Users } from "lucide-react";
import { joinAppPath } from "@/lib/config";
import { buildDashboard, getEvent } from "@/lib/state";
import { PresentControls } from "@/components/present-controls";

type PageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ key?: string }>;
};

export default async function PresentPage({ params, searchParams }: PageProps) {
  const { eventId } = await params;
  const { key = "" } = await searchParams;
  const event = await getEvent(eventId);
  if (!event || !key || key !== event.adminKey) notFound();

  const dashboard = buildDashboard(event);
  const topFinalist = dashboard.finalist[0];
  const exportUrl = `/field-cocreation/api/events/${event.id}/export?key=${encodeURIComponent(key)}`;
  const copyText = `${dashboard.counts.total} 人参与，${dashboard.counts.locked} 人锁定。`;

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />
      <header className="shell topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span>屏</span></div>
          <div>
            <small>Presentation Mode</small>
            <strong>{event.title}</strong>
          </div>
        </div>
        <div className="top-links">
          <a className="chip" href={joinAppPath(`/admin/${event.id}?key=${key}`)}>讲师控制台</a>
          <PresentControls copyText={copyText} downloadUrl={exportUrl} />
        </div>
      </header>

      <main className="shell" style={{ paddingTop: 28, paddingBottom: 40 }}>
        <section className="hero" style={{ gridTemplateColumns: "1.2fr 0.8fr" }}>
          <div className="hero-copy">
            <p className="eyebrow">PRESENTATION / 04</p>
            <h1>现在现场共有 {dashboard.counts.total} 个人，{dashboard.counts.locked} 人已经锁定回路。</h1>
            <p>{event.tagline}</p>
            <div className="hero-actions">
              <PresentControls copyText={copyText} downloadUrl={exportUrl} />
            </div>
          </div>
          <aside className="hero-panel">
            <div className="panel-title">
              <h2>现场进度</h2>
              <p>投屏摘要</p>
            </div>
            <div className="summary-grid" style={{ marginTop: 16 }}>
              <div className="summary-box">
                <div className="label"><Users size={12} /> 参与</div>
                <strong>{dashboard.counts.total}</strong>
              </div>
              <div className="summary-box">
                <div className="label"><Activity size={12} /> 进行中</div>
                <strong>{dashboard.counts.live}</strong>
              </div>
              <div className="summary-box">
                <div className="label"><Target size={12} /> 锁定</div>
                <strong>{dashboard.counts.locked}</strong>
              </div>
            </div>
          </aside>
        </section>

        <section className="section section-grid">
          <div className="card">
            <div className="section-title">
              <p className="eyebrow">TOP CHOICE</p>
              <h2>当前选定回路</h2>
            </div>
            {topFinalist ? (
              <div className="summary-box" style={{ marginTop: 16 }}>
                <div className="label">{topFinalist.session.participant.nickname || "未命名参与者"}</div>
                <strong style={{ fontSize: 26, lineHeight: 1.25 }}>{topFinalist.choice.scenario || "未填写场景"}</strong>
                <p className="muted" style={{ marginTop: 12 }}>{topFinalist.choice.routeFrom} → {topFinalist.choice.routeTo}</p>
                <p className="muted" style={{ marginTop: 12 }}>下周动作：{topFinalist.session.commitment.action || "未填写"}</p>
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 16 }}>还没有人完成锁定。</p>
            )}
          </div>

          <div className="card">
            <div className="section-title">
              <p className="eyebrow">SAMPLE</p>
              <h2>最近 4 个结果</h2>
            </div>
            <div className="stack" style={{ marginTop: 16 }}>
              {Object.values(event.sessions).slice(0, 4).map((session) => {
                const choice = session.finalChoiceId ? session.candidates.find((candidate) => candidate.id === session.finalChoiceId) : null;
                return (
                  <div key={session.id} className="summary-box">
                    <div className="label">{session.participant.nickname || "未命名参与者"}</div>
                    <strong>{choice?.scenario || "未锁定"}</strong>
                    <p className="muted" style={{ marginTop: 8 }}>{session.commitment.action || "下周动作未填写"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="footer-note">
          <ShieldCheck size={14} style={{ verticalAlign: "-2px" }} /> 这一页只给现场讲师和投屏使用，参与者不会看到管理员密钥。
        </div>
      </main>
    </div>
  );
}
