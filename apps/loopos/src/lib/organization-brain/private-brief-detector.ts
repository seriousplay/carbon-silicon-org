import type {
  PrivateBrief,
  PrivateBriefSafeAction,
  PrivateBriefSignal,
  PrivateBriefSignalKind,
  PrivateBriefSource,
  PrivateBriefSourceType,
} from "./private-brief-types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PrivateBriefGoalFact = Readonly<{
  id: string;
  title: string;
  circleId: string;
  circleName: string;
  cycleId: string;
  status: "ACTIVE" | "INACTIVE";
  isPrimary: boolean;
  lastCheckInAt: string | null;
  applicationUrl: string;
}>;

export type PrivateBriefTargetFact = Readonly<{
  id: string;
  goalId: string;
  goalTitle: string;
  label: string;
  evidenceAt: string | null;
  applicationUrl: string;
}>;

export type PrivateBriefMeetingFact = Readonly<{
  id: string;
  title: string;
  type: "TACTICAL" | "GOVERNANCE" | "STRATEGY";
  circleId: string;
  startedAt: string;
  unresolvedOutputCount: number;
  applicationUrl: string;
}>;

export type PrivateBriefTensionFact = Readonly<{
  id: string;
  title: string;
  circleId: string;
  circleName: string;
  status: "OPEN" | "CLOSED";
  similarityKey: string | null;
  createdAt: string;
  applicationUrl: string;
}>;

export type PrivateBriefWorkFact = Readonly<{
  id: string;
  kind: "PROJECT" | "ACTION";
  title: string;
  status: "ACTIVE" | "DONE" | "DROPPED";
  ownerPersonId: string | null;
  roleId: string | null;
  circleId: string | null;
  applicationUrl: string;
}>;

export type PrivateBriefCircleFact = Readonly<{
  id: string;
  name: string;
  parentCircleId: string | null;
  applicationUrl: string;
}>;

export type PrivateBriefDetectorInput = Readonly<{
  now: Date;
  actorPersonId: string;
  windowDays?: number;
  maxSignals?: number;
  staleGoalDays?: number;
  staleTargetDays?: number;
  recentMeetingDays?: number;
  repeatedTensionWindowDays?: number;
  goals?: readonly PrivateBriefGoalFact[];
  targets?: readonly PrivateBriefTargetFact[];
  meetings?: readonly PrivateBriefMeetingFact[];
  tensions?: readonly PrivateBriefTensionFact[];
  work?: readonly PrivateBriefWorkFact[];
  circles?: readonly PrivateBriefCircleFact[];
}>;

function daysSince(now: Date, value: string | null): number | null {
  if (value === null) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed) / DAY_MS));
}

function source(
  type: PrivateBriefSourceType,
  id: string,
  label: string,
  applicationUrl: string | null,
  observedAt: string,
): PrivateBriefSource | null {
  if (!id || !label || !observedAt || !applicationUrl?.startsWith("/app/")) {
    return null;
  }
  return Object.freeze({ type, id, label, applicationUrl, observedAt });
}

function action(
  kind: PrivateBriefSafeAction["kind"],
  label: string,
  applicationUrl: string,
): PrivateBriefSafeAction | null {
  if (!label || !applicationUrl.startsWith("/app/")) return null;
  return Object.freeze({ kind, label, applicationUrl });
}

function signal(input: {
  kind: PrivateBriefSignalKind;
  source: PrivateBriefSource | null;
  title: string;
  reason: string;
  evidenceAgeDays: number | null;
  action: PrivateBriefSafeAction | null;
  secondarySources?: readonly PrivateBriefSource[];
  severity?: PrivateBriefSignal["severity"];
}): PrivateBriefSignal | null {
  if (!input.source) return null;
  if (!input.action) return null;
  const sources = [input.source, ...(input.secondarySources ?? [])]
    .filter((entry) => entry !== null);
  if (sources.length === 0) return null;
  return Object.freeze({
    kind: input.kind,
    dedupeKey: `${input.kind}:${input.source.type}:${input.source.id}`,
    title: input.title,
    reason: input.reason,
    severity: input.severity ?? "attention",
    evidenceAgeDays: input.evidenceAgeDays,
    sources: Object.freeze(sources),
    action: input.action,
  });
}

function pushIfPresent(signals: PrivateBriefSignal[], entry: PrivateBriefSignal | null): void {
  if (entry) signals.push(entry);
}

function activePrimaryGoalCircleIds(goals: readonly PrivateBriefGoalFact[]): Set<string> {
  return new Set(
    goals
      .filter((goal) => goal.status === "ACTIVE" && goal.isPrimary)
      .map((goal) => goal.circleId),
  );
}

function sortSignals(signals: readonly PrivateBriefSignal[]): readonly PrivateBriefSignal[] {
  return Object.freeze(
    [...signals].sort((left, right) => {
      if (left.severity !== right.severity) return left.severity === "risk" ? -1 : 1;
      return left.dedupeKey.localeCompare(right.dedupeKey);
    }),
  );
}

function dedupe(signals: readonly PrivateBriefSignal[]): readonly PrivateBriefSignal[] {
  const seen = new Set<string>();
  const result: PrivateBriefSignal[] = [];
  for (const entry of sortSignals(signals)) {
    if (seen.has(entry.dedupeKey)) continue;
    seen.add(entry.dedupeKey);
    result.push(entry);
  }
  return Object.freeze(result);
}

export function buildPrivateBrief(input: PrivateBriefDetectorInput): PrivateBrief {
  const windowDays = input.windowDays ?? 7;
  const maxSignals = input.maxSignals ?? 20;
  const staleGoalDays = input.staleGoalDays ?? 14;
  const staleTargetDays = input.staleTargetDays ?? 14;
  const recentMeetingDays = input.recentMeetingDays ?? 14;
  const repeatedTensionWindowDays = input.repeatedTensionWindowDays ?? 30;
  const goals = input.goals ?? [];
  const targets = input.targets ?? [];
  const meetings = input.meetings ?? [];
  const tensions = input.tensions ?? [];
  const work = input.work ?? [];
  const circles = input.circles ?? [];
  const signals: PrivateBriefSignal[] = [];

  for (const goal of goals) {
    if (goal.status !== "ACTIVE") continue;
    const age = daysSince(input.now, goal.lastCheckInAt);
    if (age !== null && age < staleGoalDays) continue;
    pushIfPresent(signals, signal({
      kind: "STALE_GOAL_CHECK_IN",
      source: source("goal", goal.id, goal.title, goal.applicationUrl, goal.lastCheckInAt ?? input.now.toISOString()),
      title: `目标需要更新证据：${goal.title}`,
      reason: age === null
        ? "这个活跃目标还没有可用的进展证据。"
        : `这个活跃目标的最新证据已经 ${age} 天未更新。`,
      evidenceAgeDays: age,
      action: action("OPEN_GOAL_TREE", "查看目标树", goal.applicationUrl),
      severity: "risk",
    }));
  }

  for (const target of targets) {
    const age = daysSince(input.now, target.evidenceAt);
    if (age !== null && age < staleTargetDays) continue;
    pushIfPresent(signals, signal({
      kind: "MISSING_TARGET_EVIDENCE",
      source: source("target", target.id, target.label, target.applicationUrl, target.evidenceAt ?? input.now.toISOString()),
      title: `目标指标缺少证据：${target.label}`,
      reason: age === null
        ? "这个 Target 没有当前证据。"
        : `这个 Target 的证据已经 ${age} 天未更新。`,
      evidenceAgeDays: age,
      action: action("OPEN_GOAL_TREE", "补充目标证据", target.applicationUrl),
    }));
  }

  for (const meeting of meetings) {
    const age = daysSince(input.now, meeting.startedAt);
    if (age === null || age > recentMeetingDays || meeting.unresolvedOutputCount <= 0) continue;
    pushIfPresent(signals, signal({
      kind: "UNRESOLVED_MEETING_OUTPUT",
      source: source("meeting", meeting.id, meeting.title, meeting.applicationUrl, meeting.startedAt),
      title: `会议输出还未闭环：${meeting.title}`,
      reason: `这场会议还有 ${meeting.unresolvedOutputCount} 项输出没有进入已接受的下一步。`,
      evidenceAgeDays: age,
      action: action("OPEN_MEETING", "打开会议", meeting.applicationUrl),
      severity: "risk",
    }));
  }

  const openTensionGroups = new Map<string, PrivateBriefTensionFact[]>();
  for (const tension of tensions) {
    if (tension.status !== "OPEN" || !tension.similarityKey) continue;
    const age = daysSince(input.now, tension.createdAt);
    if (age === null || age > repeatedTensionWindowDays) continue;
    const key = `${tension.circleId}:${tension.similarityKey}`;
    openTensionGroups.set(key, [...(openTensionGroups.get(key) ?? []), tension]);
  }
  for (const group of openTensionGroups.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    pushIfPresent(signals, signal({
      kind: "REPEATED_TENSION",
      source: source("tension", first.id, first.title, first.applicationUrl, first.createdAt),
      title: `重复张力正在出现：${first.circleName}`,
      reason: `同一回路最近出现了 ${group.length} 个相似未关闭张力。`,
      evidenceAgeDays: daysSince(input.now, first.createdAt),
      action: action("RAISE_TENSION", "查看相关张力", first.applicationUrl),
      secondarySources: group.slice(1, 4).map((entry) =>
        source("tension", entry.id, entry.title, entry.applicationUrl, entry.createdAt),
      ).filter((entry): entry is PrivateBriefSource => entry !== null),
    }));
  }

  for (const item of work) {
    if (
      item.status !== "ACTIVE" ||
      item.ownerPersonId !== input.actorPersonId ||
      (item.roleId && item.circleId)
    ) {
      continue;
    }
    pushIfPresent(signals, signal({
      kind: "ROLE_WORK_MISMATCH",
      source: source(
        item.kind === "PROJECT" ? "project" : "action",
        item.id,
        item.title,
        item.applicationUrl,
        input.now.toISOString(),
      ),
      title: `工作缺少清晰角色或回路：${item.title}`,
      reason: "这个活跃工作与当前承担者相关，但缺少明确的 Role 或 Circle 归属。",
      evidenceAgeDays: null,
      action: action("OPEN_SOURCE", "查看工作", item.applicationUrl),
    }));
  }

  const primaryGoalCircles = activePrimaryGoalCircleIds(goals);
  for (const circle of circles) {
    if (!circle.parentCircleId || !primaryGoalCircles.has(circle.parentCircleId)) continue;
    if (primaryGoalCircles.has(circle.id)) continue;
    pushIfPresent(signals, signal({
      kind: "MISSING_CHILD_GOAL",
      source: source("circle", circle.id, circle.name, circle.applicationUrl, input.now.toISOString()),
      title: `子回路缺少主目标：${circle.name}`,
      reason: "父回路已有活跃主目标，但这个子回路还没有对应周期的活跃主目标。",
      evidenceAgeDays: null,
      action: action("OPEN_GOAL_TREE", "查看目标树", circle.applicationUrl),
      severity: "risk",
    }));
  }

  const uniqueSignals = dedupe(signals);
  return Object.freeze({
    schemaVersion: 1,
    generatedAt: input.now.toISOString(),
    windowDays,
    signals: Object.freeze(uniqueSignals.slice(0, maxSignals)),
    truncated: uniqueSignals.length > maxSignals,
  });
}
