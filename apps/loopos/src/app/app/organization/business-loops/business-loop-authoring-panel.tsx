"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import {
  addBusinessLoopActivityAction,
  addBusinessLoopEdgeAction,
  addBusinessLoopEvidenceLabelAction,
  publishBusinessLoopDraftAction,
  saveBusinessLoopDraftAction,
  type BusinessLoopAuthoringState,
} from "./actions";

type Option = Readonly<{ id: string; name: string }>;
type DraftLoop = Readonly<{ id: string; name: string; purpose: string | null; status: string }>;

type BusinessLoopAuthoringPanelProps = Readonly<{
  draftLoops: readonly DraftLoop[];
  circles: readonly Option[];
  roles: readonly Option[];
  interfaces: readonly Option[];
}>;

function Message({ state }: { state: BusinessLoopAuthoringState }) {
  if (!state?.error && !state?.success) return null;
  return (
    <p className={state.error ? "text-sm text-destructive" : "text-sm text-moss"}>
      {state.error ?? state.success}
    </p>
  );
}

function SelectOptions({ options, emptyLabel }: { options: readonly Option[]; emptyLabel: string }) {
  return (
    <>
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </>
  );
}

export function BusinessLoopAuthoringPanel({
  draftLoops,
  circles,
  roles,
  interfaces,
}: BusinessLoopAuthoringPanelProps) {
  const [loopState, saveLoop, savingLoop] = useActionState(saveBusinessLoopDraftAction, undefined);
  const [activityState, addActivity, addingActivity] = useActionState(addBusinessLoopActivityAction, undefined);
  const [edgeState, addEdge, addingEdge] = useActionState(addBusinessLoopEdgeAction, undefined);
  const [evidenceState, addEvidence, addingEvidence] = useActionState(addBusinessLoopEvidenceLabelAction, undefined);
  const [publishState, publishLoop, publishingLoop] = useActionState(publishBusinessLoopDraftAction, undefined);
  const firstDraftLoop = draftLoops[0];

  return (
    <section className="rounded-card border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">业务回路草稿</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            这里只记录运营流动事实。角色、职责、任命、决策权和组织结构变更仍然需要通过治理流程。
          </p>
        </div>
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">ORG_ADMIN</span>
      </div>

      <form action={saveLoop} className="mt-4 grid gap-3 lg:grid-cols-[1fr_2fr_auto]">
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          placeholder="业务回路名称"
          className="h-10 rounded-input border border-border bg-background px-3 text-sm"
        />
        <input
          name="purpose"
          maxLength={500}
          placeholder="目的，例如：从客户需求到模型能力上线的闭环"
          className="h-10 rounded-input border border-border bg-background px-3 text-sm"
        />
        <button
          type="submit"
          disabled={savingLoop}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-input bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Plus aria-hidden="true" className="size-4" />
          {savingLoop ? "保存中" : "新建草稿"}
        </button>
        <div className="lg:col-span-3">
          <Message state={loopState} />
        </div>
      </form>

      {firstDraftLoop ? (
        <>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background p-4">
          <div>
            <h3 className="text-sm font-medium">{firstDraftLoop.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              当前草稿可以继续补充，也可以在活动和流动齐备后发布为正式版本。
            </p>
          </div>
          <form action={publishLoop}>
            <input type="hidden" name="loopId" value={firstDraftLoop.id} />
            <button
              type="submit"
              disabled={publishingLoop}
              className="h-9 rounded-input border border-border bg-card px-3 text-sm font-medium disabled:opacity-60"
            >
              {publishingLoop ? "发布中" : "发布正式版本"}
            </button>
          </form>
          <div className="basis-full">
            <Message state={publishState} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <form action={addActivity} className="space-y-3 rounded-md border border-border bg-background p-4">
            <input type="hidden" name="loopId" value={firstDraftLoop.id} />
            <h3 className="text-sm font-medium">添加活动</h3>
            <input
              name="activityName"
              required
              minLength={2}
              maxLength={120}
              placeholder="活动名称"
              className="h-9 w-full rounded-input border border-border bg-card px-3 text-sm"
            />
            <select name="activityType" className="h-9 w-full rounded-input border border-border bg-card px-3 text-sm" defaultValue="WORK">
              <option value="WORK">工作</option>
              <option value="DECISION">决策</option>
              <option value="HANDOFF">交接</option>
              <option value="SIGNAL">信号</option>
            </select>
            <select name="circleId" className="h-9 w-full rounded-input border border-border bg-card px-3 text-sm">
              <SelectOptions options={circles} emptyLabel="关联结构，可选" />
            </select>
            <select name="ownerRoleId" className="h-9 w-full rounded-input border border-border bg-card px-3 text-sm">
              <SelectOptions options={roles} emptyLabel="关联角色，可选" />
            </select>
            <button type="submit" disabled={addingActivity} className="h-9 w-full rounded-input bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60">
              {addingActivity ? "保存中" : "加入活动"}
            </button>
            <Message state={activityState} />
          </form>

          <form action={addEdge} className="space-y-3 rounded-md border border-border bg-background p-4">
            <input type="hidden" name="loopId" value={firstDraftLoop.id} />
            <h3 className="text-sm font-medium">添加流动</h3>
            <input
              name="edgeLabel"
              required
              minLength={2}
              maxLength={160}
              placeholder="流动名称"
              className="h-9 w-full rounded-input border border-border bg-card px-3 text-sm"
            />
            <select name="edgeType" className="h-9 w-full rounded-input border border-border bg-card px-3 text-sm" defaultValue="VALUE">
              <option value="VALUE">价值</option>
              <option value="DATA">数据</option>
              <option value="DECISION_SIGNAL">决策信号</option>
              <option value="EVIDENCE">证据</option>
            </select>
            <select name="fromCircleId" className="h-9 w-full rounded-input border border-border bg-card px-3 text-sm">
              <SelectOptions options={circles} emptyLabel="起点结构，可选" />
            </select>
            <select name="toCircleId" className="h-9 w-full rounded-input border border-border bg-card px-3 text-sm">
              <SelectOptions options={circles} emptyLabel="终点结构，可选" />
            </select>
            <select name="interfaceId" className="h-9 w-full rounded-input border border-border bg-card px-3 text-sm">
              <SelectOptions options={interfaces} emptyLabel="接口证据，可选" />
            </select>
            <button type="submit" disabled={addingEdge} className="h-9 w-full rounded-input bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60">
              {addingEdge ? "保存中" : "加入流动"}
            </button>
            <Message state={edgeState} />
          </form>

          <form action={addEvidence} className="space-y-3 rounded-md border border-border bg-background p-4">
            <input type="hidden" name="loopId" value={firstDraftLoop.id} />
            <h3 className="text-sm font-medium">添加证据标签</h3>
            <input
              name="evidenceLabel"
              required
              minLength={2}
              maxLength={160}
              placeholder="证据标签"
              className="h-9 w-full rounded-input border border-border bg-card px-3 text-sm"
            />
            <button type="submit" disabled={addingEvidence} className="h-9 w-full rounded-input bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60">
              {addingEvidence ? "保存中" : "加入证据"}
            </button>
            <Message state={evidenceState} />
          </form>
        </div>
        </>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          先创建一个业务回路草稿，再补充活动、流动和证据标签。
        </p>
      )}
    </section>
  );
}
