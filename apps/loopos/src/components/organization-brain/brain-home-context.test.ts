import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { OrganizationBrainHomeProjection } from "@/lib/organization-brain/home-read-model";
import { BrainHomeContext } from "./brain-home-context";

const source = readFileSync(new URL("./brain-home-context.tsx", import.meta.url), "utf8");

const readyProjection = {
  status: "READY",
  generatedAt: "2026-07-17T08:00:00.000Z",
  freshnessStatus: "CURRENT",
  freshnessLabel: "更新至 2026年7月17日",
  focusItems: [
    {
      id: "focus-a",
      kind: "tension",
      title: "先处理治理张力",
      change: "张力已进入待处理状态",
      summary: "需要进入既定会议流程。",
      relevance: "你是该张力的提出者",
      evidence: {
        kind: "tension",
        id: "source-a",
        label: "张力记录 A",
        applicationUrl: "/app/tensions/a",
        observedAt: "2026-07-17T07:00:00.000Z",
        freshness: "FRESH",
        freshnessLabel: "今天",
      },
      action: { label: "打开张力", applicationUrl: "/app/tensions/a" },
    },
    {
      id: "focus-b",
      kind: "meeting",
      title: "准备下一场会议",
      change: "会议时间已经确定",
      summary: "议程已经可以查看。",
      relevance: "你是参会成员",
      evidence: {
        kind: "meeting",
        id: "source-b",
        label: "会议记录 B",
        applicationUrl: "/app/meetings/b",
        observedAt: "2026-07-16T07:00:00.000Z",
        freshness: "FRESH",
        freshnessLabel: "1 天前",
      },
      action: { label: "打开会议", applicationUrl: "/app/meetings/b" },
    },
  ],
  healthyState: {
    goal: { id: "goal-a", title: "本周期主目标", applicationUrl: "/app/goals/a" },
    nextMeeting: {
      id: "meeting-b",
      title: "周度战术会",
      startsAt: "2026-07-18T08:00:00.000Z",
      applicationUrl: "/app/meetings/b",
    },
    activeProjects: [
      { id: "project-a", title: "真实团队试运行", applicationUrl: "/app/projects/a" },
    ],
  },
} as const satisfies OrganizationBrainHomeProjection;

test("Brain home keeps M6-1B focus order, source links, action links, and healthy state intact", () => {
  const markup = renderToStaticMarkup(createElement(BrainHomeContext, { projection: readyProjection }));

  assert.ok(markup.indexOf("先处理治理张力") < markup.indexOf("准备下一场会议"));
  for (const value of [
    "张力已进入待处理状态",
    "会议时间已经确定",
    "href=\"/app/tensions/a\"",
    "href=\"/app/meetings/b\"",
    "本周期主目标",
    "周度战术会",
    "真实团队试运行",
    "感知已同步",
    "2/3",
  ]) {
    assert.match(markup, new RegExp(value));
  }
  assert.doesNotMatch(markup, /source-a|source-b|goal-a|project-a/);
});

test("limited and empty projections render explicit honest sensing states", () => {
  const projection = {
    ...readyProjection,
    freshnessStatus: "LIMITED",
    freshnessLabel: "部分来源暂时不可用",
    focusItems: [],
  } as const satisfies OrganizationBrainHomeProjection;
  const markup = renderToStaticMarkup(createElement(BrainHomeContext, { projection }));

  assert.match(markup, /新鲜度受限/);
  assert.match(markup, /当前没有需要优先处理的事项/);
  assert.match(markup, /0\/3/);
});

test("denied projection renders no organization data and explains the permission boundary", () => {
  const projection = {
    status: "DENIED",
    focusItems: [],
    healthyState: null,
  } as const satisfies OrganizationBrainHomeProjection;
  const markup = renderToStaticMarkup(createElement(BrainHomeContext, { projection }));

  assert.match(markup, /当前无法读取组织上下文/);
  assert.match(markup, /没有可展示的授权数据/);
  assert.doesNotMatch(markup, /本周期主目标|周度战术会|真实团队试运行/);
});

test("Brain home context remains a read-only navigation projection without mutation surfaces", () => {
  assert.match(source, /projection\.focusItems\.map/);
  assert.match(source, /item\.change/);
  assert.match(source, /item\.evidence\.applicationUrl/);
  assert.match(source, /item\.action\.applicationUrl/);
  assert.doesNotMatch(source, /<form|<button|onClick=|server action|mutation/i);
  assert.doesNotMatch(source, /gradient|purple|violet|indigo|animate-|orb|particle/i);
});
