"use client";

import { useEffect, useState } from "react";
import { Copy, ShieldCheck, Users, Target, Activity } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { joinAppPath } from "@/lib/config";
import type { EventRecord } from "@/lib/types";

export default function AdminPage() {
  const params = useParams<{ eventId: string }>();
  const searchParams = useSearchParams();
  const eventId = params.eventId;
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(() => searchParams.get("key") ?? "");
  const [authorized, setAuthorized] = useState(false);

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

  async function loadDashboard() {
    if (!eventId || !key) return;
    const response = await fetch(`/field-cocreation/api/events/${eventId}/summary?key=${encodeURIComponent(key)}`);
    const data = await response.json();
    if (response.ok) {
      setAuthorized(true);
      setEvent(data.dashboard.event as EventRecord);
      return;
    }
    setAuthorized(false);
    setError(data.error || "授权失败");
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  if (error && !event) {
    return (
      <main className="shell" style={{ padding: 40 }}>
        <div className="card">{error}</div>
      </main>
    );
  }

  if (!event) {
    return <main className="shell" style={{ padding: 40 }}><div className="card">加载中…</div></main>;
  }

  const sessions = Object.values(event.sessions);
  const locked = sessions.filter((item) => item.status === "locked" || item.status === "submitted");
  const active = sessions.filter((item) => item.status === "active" || item.status === "draft");

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />
      <header className="shell topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span>看</span></div>
          <div>
            <small>Instructor Console</small>
            <strong>{event.title}</strong>
          </div>
        </div>
        <div className="top-links">
          <a className="chip" href={joinAppPath(`/e/${event.id}`)}>参与者入口</a>
          <a className="chip" href={joinAppPath(`/present/${event.id}?key=${encodeURIComponent(key)}`)}>投屏页</a>
          <a className="chip" href={`/field-cocreation/api/events/${event.id}/export?key=${encodeURIComponent(key)}`}>导出</a>
              <button className="chip" onClick={() => void copy(window.location.href)} type="button"><Copy size={14} /> 复制当前链接</button>
            </div>
          </header>

      <main className="shell">
        <section className="hero" style={{ paddingTop: 28 }}>
          <div className="hero-copy">
            <p className="eyebrow">DASHBOARD / 03</p>
            <h1>讲师只看三件事：进度、选定回路、下周动作。</h1>
            <p>{event.tagline}</p>
            <div className="hero-actions">
              <button className="solid-btn" onClick={() => void loadDashboard()} type="button">
                <ShieldCheck size={16} /> 刷新看板
              </button>
            </div>
            {error ? <p className="muted" style={{ color: "var(--danger)", marginTop: 12 }}>{error}</p> : null}
          </div>

          <aside className="hero-panel">
            <div className="panel-title">
              <h2>现场状态</h2>
              <p>{authorized ? "已授权" : "待验证"}</p>
            </div>
            <div className="summary-grid" style={{ marginTop: 16 }}>
              <div className="summary-box">
                <div className="label"><Users size={12} /> 参与人数</div>
                <strong>{sessions.length}</strong>
              </div>
              <div className="summary-box">
                <div className="label"><Activity size={12} /> 进行中</div>
                <strong>{active.length}</strong>
              </div>
              <div className="summary-box">
                <div className="label"><Target size={12} /> 已锁定</div>
                <strong>{locked.length}</strong>
              </div>
            </div>
          </aside>
        </section>

        <section className="section section-grid">
          <div className="card">
            <div className="section-title">
              <p className="eyebrow">ACCESS</p>
              <h2>管理员密钥</h2>
            </div>
            <div className="field-grid" style={{ marginTop: 16 }}>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>密钥</label>
                <input value={key} onChange={(event) => setKey(event.target.value)} />
              </div>
            </div>
            <div className="hero-actions">
              <button className="solid-btn" onClick={() => void loadDashboard()} type="button">验证并加载</button>
            </div>
          </div>

          <div className="card">
            <div className="section-title">
              <p className="eyebrow">OVERVIEW</p>
              <h2>最近结果</h2>
            </div>
            <div className="stack" style={{ marginTop: 16 }}>
              {sessions.length ? sessions.slice(0, 4).map((session) => (
                <div key={session.id} className="summary-box">
                  <div className="label">{session.participant.nickname || "未命名参与者"}</div>
                  <strong>{session.finalChoiceId ? session.candidates.find((candidate) => candidate.id === session.finalChoiceId)?.scenario || "已锁定" : "未锁定"}</strong>
                  <p className="muted" style={{ marginTop: 8 }}>{session.commitment.action || "未填写下周动作"}</p>
                </div>
              )) : <p className="muted">还没有参与者开始填写。</p>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
