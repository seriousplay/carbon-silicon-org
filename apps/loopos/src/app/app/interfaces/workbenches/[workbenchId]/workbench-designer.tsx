"use client";

import "@xyflow/react/dist/style.css";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Background, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider,
  applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange, type NodeProps,
} from "@xyflow/react";
import {
  ArrowLeft, Braces, Check, ChevronRight, CircleStop, GitCompareArrows, GitFork,
  Inbox, Paperclip, Plus, Save, ShieldCheck, Sparkles, Trash2, UserCheck, Users, Workflow, XOctagon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { WorkbenchEditorDto } from "@/lib/interface-workbench/dto";
import { addSafeNode, connectSafeNodes, definitionToFlow, flowToDefinition, hasPersistentEdgeChanges, nodeLabel, removeSafeNode, resolveSavedEditorState, stableId, transitionEditorState, type EditorSyncState, type WorkbenchFlowEdge, type WorkbenchFlowNode } from "@/lib/interface-workbench/editor";
import { structuralDiff } from "@/lib/interface-workbench/diff";
import { createAIProposalRequestToken, isAIProposalCurrent, layoutForAIProposal, type AIProposalError, type AIProposalRequestToken, type AIProposalResult } from "@/lib/interface-workbench/ai-proposal";
import { WORKFLOW_CAPABILITIES, type SafeWorkflowNode, type WorkflowCapability, type WorkflowDefinition, type WorkflowValidationIssue } from "@/lib/interface-workbench/protocol";
import { compareVersionsAction, publishDesignerAction, saveDesignerAction, validateDesignerAction, type DesignerActionState } from "./actions";
import { proposeWorkflowAction } from "./ai-actions";

const NODE_TYPES: SafeWorkflowNode["type"][] = [
  "structured_evidence_input", "attachment_input", "ai_extract", "human_confirmation", "condition", "wait_for_role",
  "raise_tension", "route_tactical_meeting", "create_project", "create_action", "mark_governance_candidate",
  "route_governance_meeting", "complete", "terminate",
];

const ICONS: Record<SafeWorkflowNode["type"], typeof Workflow> = {
  structured_evidence_input: Inbox, attachment_input: Paperclip, ai_extract: Sparkles, human_confirmation: UserCheck,
  condition: GitFork, wait_for_role: Users, raise_tension: XOctagon, route_tactical_meeting: ChevronRight,
  create_project: Braces, create_action: Check, mark_governance_candidate: ShieldCheck, route_governance_meeting: Workflow,
  complete: CircleStop, terminate: XOctagon,
};

const initialActionState: DesignerActionState = { status: "idle" };
const WORKFLOW_NODE_TYPES = { workflow: WorkflowNode };
const MOBILE_QUERY = "(max-width: 767px)";

export function WorkbenchDesigner({ initial }: { initial: WorkbenchEditorDto }) {
  return <ReactFlowProvider><DesignerInner initial={initial} /></ReactFlowProvider>;
}

function DesignerInner({ initial }: { initial: WorkbenchEditorDto }) {
  const initialFlow = useMemo(() => definitionToFlow(initial.draft, initial.draftLayout), [initial]);
  const [definition, setDefinition] = useState(initial.draft);
  const [nodes, setNodes] = useState(initialFlow.nodes);
  const [edges, setEdges] = useState(initialFlow.edges);
  const [selectedId, setSelectedId] = useState(initial.draft.entryNodeId);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [sync, setSync] = useState<EditorSyncState>("saved");
  const [revision, setRevision] = useState(initial.draftRevision);
  const [hash, setHash] = useState(initial.draftHash);
  const [issues, setIssues] = useState<WorkflowValidationIssue[]>([]);
  const [compare, setCompare] = useState<Array<{ kind: string; path: string; before?: unknown; after?: unknown }> | null>(null);
  const [comparePending, setComparePending] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [aiResult, setAiResult] = useState<AIProposalResult | null>(null);
  const [aiRequestToken, setAiRequestToken] = useState<AIProposalRequestToken | null>(null);
  const [saveState, saveAction, savePending] = useActionState(saveDesignerAction.bind(null, initial.id), initialActionState);
  const [validateState, validateAction, validatePending] = useActionState(validateDesignerAction.bind(null, initial.id), initialActionState);
  const [publishState, publishAction, publishPending] = useActionState(publishDesignerAction.bind(null, initial.id), initialActionState);
  const editSequence = useRef(0);
  const [renderedEditSequence, setRenderedEditSequence] = useState(0);
  const submittedSaveSequence = useRef(0);
  const mobile = useMobileWorkbench();
  const projected = flowToDefinition(definition, nodes, edges);
  const selected = definition.nodes.find((node) => node.id === selectedId) ?? null;

  useEffect(() => {
    /* Server Action completion synchronizes the local CAS token. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saveState.status === "saved") { setRevision(saveState.revision); setHash(saveState.hash); setSync(resolveSavedEditorState(submittedSaveSequence.current, editSequence.current)); }
    if (saveState.status === "stale") setSync("stale");
    if (saveState.status === "error") setSync("unsaved");
  }, [saveState]);
  useEffect(() => {
    /* Validation results drive node-focused review state. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (validateState.status === "invalid") setIssues(validateState.issues);
    if (validateState.status === "valid") setIssues([]);
  }, [validateState]);
  useEffect(() => {
    /* Publication can return compiler issues or a stale lock result. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (publishState.status === "invalid") setIssues(publishState.issues);
    if (publishState.status === "stale") setSync("stale");
    if (publishState.status === "published") window.location.reload();
  }, [publishState]);

  function changed(nextDefinition = definition, nextNodes = nodes, nextEdges = edges) {
    editSequence.current += 1;
    setRenderedEditSequence(editSequence.current);
    setDefinition(nextDefinition); setNodes(nextNodes); setEdges(nextEdges); setSync((state) => transitionEditorState(state, "edit"));
  }

  function addNode(type: SafeWorkflowNode["type"]) {
    const node = createNode(type, stableId(type, definition.nodes.map((item) => item.id)), definition);
    const result = addSafeNode(definition, projected.layout, node, { x: 80 + (nodes.length % 3) * 260, y: 80 + Math.floor(nodes.length / 3) * 150 });
    const flow = definitionToFlow(result.definition, result.layout);
    changed(result.definition, flow.nodes, flow.edges); setSelectedId(node.id);
  }

  function removeSelected() {
    if (!selected || selected.id === definition.entryNodeId) return;
    const result = removeSafeNode(definition, projected.layout, selected.id);
    const flow = definitionToFlow(result.definition, result.layout);
    changed(result.definition, flow.nodes, flow.edges); setSelectedId(definition.entryNodeId);
  }

  function updateDefinition(next: WorkflowDefinition) {
    const flow = definitionToFlow(next, projected.layout); changed(next, flow.nodes, flow.edges);
  }

  function updateNode(next: SafeWorkflowNode) {
    updateDefinition({ ...definition, nodes: definition.nodes.map((node) => node.id === next.id ? next : node) });
  }

  function onNodesChange(changes: NodeChange<WorkbenchFlowNode>[]) {
    const next = applyNodeChanges(changes, nodes);
    setNodes(next);
    if (changes.some((change) => change.type === "position" && change.dragging === false)) { editSequence.current += 1; setRenderedEditSequence(editSequence.current); setSync((state) => transitionEditorState(state, "edit")); }
  }

  function onEdgesChange(changes: EdgeChange<WorkbenchFlowEdge>[]) {
    const next = applyEdgeChanges(changes, edges);
    if (hasPersistentEdgeChanges(changes)) changed(definition, nodes, next);
    else setEdges(next);
  }

  function onConnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    const source = definition.nodes.find((node) => node.id === connection.source);
    const branch = source?.type === "condition" && (connection.sourceHandle === "true" || connection.sourceHandle === "false") ? connection.sourceHandle : undefined;
    const next = connectSafeNodes(definition, { from: connection.source, to: connection.target, branch });
    if (next === definition) return;
    const flow = definitionToFlow(next, projected.layout); changed(next, flow.nodes, flow.edges);
  }

  function removeSelectedEdge() {
    if (!selectedEdgeId) return;
    const nextEdges = edges.filter((edge) => edge.id !== selectedEdgeId);
    changed(definition, nodes, nextEdges); setSelectedEdgeId(null);
  }

  function submit(action: (formData: FormData) => void, mode: "save" | "validate" | "publish") {
    const form = new FormData();
    form.set("expectedRevision", String(revision)); form.set("expectedHash", hash);
    form.set("definition", JSON.stringify(projected.definition)); form.set("layout", JSON.stringify(projected.layout));
    if (mode === "save") { submittedSaveSequence.current = editSequence.current; setSync((state) => transitionEditorState(state, "save")); }
    startTransition(() => action(form));
  }

  function runCompare(beforeId: string, afterId: string) {
    setComparePending(true);
    startTransition(async () => { const result = await compareVersionsAction(initial.id, beforeId, afterId); setCompare(result.ok ? result.changes : []); setComparePending(false); });
  }

  function requestAIProposal() {
    const token = createAIProposalRequestToken(editSequence.current, projected.definition);
    const form = new FormData();
    form.set("instruction", aiInstruction);
    form.set("definition", JSON.stringify(projected.definition));
    setAiPending(true); setAiResult(null); setAiRequestToken(token);
    startTransition(async () => {
      try { setAiResult(await proposeWorkflowAction(initial.id, form)); }
      finally { setAiPending(false); }
    });
  }

  function applyAIProposal() {
    if (!aiResult?.ok || !aiRequestToken || !isAIProposalCurrent(aiRequestToken, editSequence.current, projected.definition)) return;
    const flow = definitionToFlow(aiResult.proposal, layoutForAIProposal(aiResult.proposal, projected.layout));
    changed(aiResult.proposal, flow.nodes, flow.edges);
    setSelectedId(aiResult.proposal.entryNodeId);
    setIssues([]); setAiOpen(false); setAiResult(null); setAiRequestToken(null); setAiInstruction("");
  }

  const actionError = [saveState, validateState, publishState].find((state) => state.status === "error");
  const duplicate = publishState.status === "duplicate";
  const stateLabel = sync === "stale" ? "版本冲突" : actionError ? "操作失败" : issues.length ? "无效" : duplicate ? "版本已存在" : publishState.status === "published" ? `已发布 v${publishState.version}` : savePending ? "保存中" : sync === "unsaved" ? "未保存" : "已保存";

  return <main className="wb-shell">
    <header className="wb-commandbar">
      <div className="wb-command-identity"><Button nativeButton={false} variant="ghost" size="icon-sm" render={<Link href="/app/interfaces/workbenches" />} title="返回工作台"><ArrowLeft /></Button><div><p>{initial.interfaceName}</p><span>接口设计器 · 草稿 r{revision}</span></div></div>
      <Badge variant={sync === "stale" || issues.length || actionError ? "destructive" : "secondary"}>{stateLabel}</Badge>
      <div className="wb-command-actions">
        {selectedEdgeId ? <Button variant="destructive" size="sm" onClick={removeSelectedEdge}><Trash2 />删除连线</Button> : null}
        <Button variant="outline" size="sm" disabled={sync === "stale"} onClick={() => setAiOpen(true)}><Sparkles />AI 提案</Button>
        <Button variant="outline" size="sm" disabled={validatePending || sync === "stale"} onClick={() => submit(validateAction, "validate")}><ShieldCheck />验证</Button>
        <Button size="sm" disabled={savePending || sync === "stale"} onClick={() => submit(saveAction, "save")}><Save />保存</Button>
        <PublishDialog disabled={publishPending || sync !== "saved"} onPublish={() => submit(publishAction, "publish")} />
      </div>
    </header>

    {actionError ? <section className="wb-action-message" role="alert">操作未完成：{actionError.error}</section> : null}
    {duplicate ? <section className="wb-action-message" role="status">当前草稿与已有不可变版本相同，未重复发布。</section> : null}

    {sync === "stale" ? <section className="wb-conflict" role="alert"><div><strong>服务器草稿已更新</strong><p>当前本地修改未覆盖服务器版本。</p></div><div><Button variant="outline" size="sm" onClick={() => location.reload()}>重新载入服务器状态</Button><Button variant="ghost" size="sm" onClick={() => setCompare(structuralDiff(initial.draft, projected.definition))}><GitCompareArrows />检查本地状态</Button></div></section> : null}

    {mobile ? <Tabs defaultValue="canvas" className="wb-mobile-tabs">
      <TabsList className="wb-mobile-tablist"><TabsTrigger value="palette">节点</TabsTrigger><TabsTrigger value="canvas">画布</TabsTrigger><TabsTrigger value="inspector">检查器</TabsTrigger><TabsTrigger value="review">审阅</TabsTrigger></TabsList>
      <div className="wb-workspace">
        <TabsContent value="palette" className="wb-pane wb-palette"><Palette onAdd={addNode} /></TabsContent>
        <TabsContent value="canvas" className="wb-canvas-wrap"><WorkbenchCanvas nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeSelect={(id) => { setSelectedId(id); setSelectedEdgeId(null); }} onEdgeSelect={setSelectedEdgeId} onPaneClick={() => setSelectedEdgeId(null)} /></TabsContent>
        <TabsContent value="inspector" className="wb-pane wb-inspector"><Inspector definition={definition} selected={selected} onDefinition={updateDefinition} onNode={updateNode} onDelete={removeSelected} /></TabsContent>
        <TabsContent value="review" className="wb-review-mobile"><ReviewPanel issues={issues} versions={initial.versions} compare={compare} pending={comparePending} onCompare={runCompare} onFocus={setSelectedId} /></TabsContent>
      </div>
    </Tabs> : <div className="wb-workspace">
      <section className="wb-pane wb-palette"><Palette onAdd={addNode} /></section>
      <section className="wb-canvas-wrap"><WorkbenchCanvas nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeSelect={(id) => { setSelectedId(id); setSelectedEdgeId(null); }} onEdgeSelect={setSelectedEdgeId} onPaneClick={() => setSelectedEdgeId(null)} /></section>
      <section className="wb-pane wb-inspector"><Inspector definition={definition} selected={selected} onDefinition={updateDefinition} onNode={updateNode} onDelete={removeSelected} /></section>
    </div>}
    {!mobile ? <div className="wb-review-desktop"><ReviewPanel issues={issues} versions={initial.versions} compare={compare} pending={comparePending} onCompare={runCompare} onFocus={setSelectedId} /></div> : null}
    <AIProposalDialog open={aiOpen} instruction={aiInstruction} pending={aiPending} result={aiResult} stale={!!aiResult?.ok && (!aiRequestToken || !isAIProposalCurrent(aiRequestToken, renderedEditSequence, projected.definition))} onOpenChange={setAiOpen} onInstruction={setAiInstruction} onGenerate={requestAIProposal} onApply={applyAIProposal} />
  </main>;
}

function WorkbenchCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeSelect, onEdgeSelect, onPaneClick }: {
  nodes: WorkbenchFlowNode[]; edges: WorkbenchFlowEdge[];
  onNodesChange: (changes: NodeChange<WorkbenchFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkbenchFlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeSelect: (id: string) => void; onEdgeSelect: (id: string) => void; onPaneClick: () => void;
}) {
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={WORKFLOW_NODE_TYPES} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, node) => onNodeSelect(node.id)} onEdgeClick={(_, edge) => onEdgeSelect(edge.id)} onPaneClick={onPaneClick} fitView minZoom={0.35} maxZoom={1.8} deleteKeyCode={null}>
    <Background gap={20} size={1} /><MiniMap pannable zoomable /><Controls showInteractive={false} />
  </ReactFlow>;
}

function useMobileWorkbench(): boolean {
  return useSyncExternalStore(
    (notify) => { const query = window.matchMedia(MOBILE_QUERY); query.addEventListener("change", notify); return () => query.removeEventListener("change", notify); },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

function WorkflowNode({ data, selected }: NodeProps<WorkbenchFlowNode>) {
  const Icon = ICONS[data.node.type]; const condition = data.node.type === "condition";
  return <div className={`wb-node${selected ? " is-selected" : ""}`}><Handle type="target" position={Position.Left} /><div className="wb-node-icon"><Icon /></div><div><strong>{data.label}</strong><span>{data.node.id}</span></div>{condition ? <><Handle id="true" type="source" position={Position.Right} style={{ top: "34%" }} /><Handle id="false" type="source" position={Position.Right} style={{ top: "70%" }} /></> : <Handle type="source" position={Position.Right} />}</div>;
}

function Palette({ onAdd }: { onAdd: (type: SafeWorkflowNode["type"]) => void }) {
  return <><div className="wb-pane-heading"><span>安全节点</span><Badge variant="outline">14</Badge></div><div className="wb-palette-list">{NODE_TYPES.map((type) => { const Icon = ICONS[type]; return <button key={type} type="button" onClick={() => onAdd(type)}><Icon /><span>{nodeLabel(type)}</span><Plus /></button>; })}</div></>;
}

function Inspector({ definition, selected, onDefinition, onNode, onDelete }: { definition: WorkflowDefinition; selected: SafeWorkflowNode | null; onDefinition: (value: WorkflowDefinition) => void; onNode: (value: SafeWorkflowNode) => void; onDelete: () => void }) {
  const settings = <section className="wb-workflow-settings"><div className="wb-pane-heading"><span>工作流设置</span></div><div className="wb-settings-fields"><Field label="工作流名称"><Input value={definition.name} onChange={(event) => onDefinition({ ...definition, name: event.target.value })} /></Field><Field label="入口节点"><select className="wb-select" value={definition.entryNodeId} onChange={(event) => onDefinition({ ...definition, entryNodeId: event.target.value })}>{definition.nodes.map((node) => <option key={node.id} value={node.id}>{nodeLabel(node.type)} · {node.id}</option>)}</select></Field></div></section>;
  if (!selected) return <>{settings}<div className="wb-empty">未选择节点</div></>;
  const current = selected;
  const config = selected.config as Record<string, unknown>;
  function setConfig(key: string, value: unknown) {
    const next = { ...config, [key]: value };
    if (current.type === "condition" && key === "operator") {
      if (value === "exists") delete next.value;
      else if (!("value" in next)) next.value = "";
    }
    onNode({ ...current, config: next } as SafeWorkflowNode);
  }
  return <>{settings}<div className="wb-pane-heading"><span>节点检查器</span><Button variant="ghost" size="icon-xs" title="删除节点" disabled={selected.id === definition.entryNodeId} onClick={onDelete}><Trash2 /></Button></div>
    <div className="wb-inspector-scroll"><Field label="节点 ID"><Input value={selected.id} disabled /></Field><Field label="节点类型"><Input value={nodeLabel(selected.type)} disabled /></Field>
      {Object.entries(config).map(([key, value]) => <ConfigField key={key} name={key} value={value} definition={definition} nodeType={selected.type} onChange={(next) => setConfig(key, next)} />)}
      <section className="wb-inspector-section"><div className="wb-pane-heading"><span>角色与能力</span><Button variant="ghost" size="icon-xs" title="添加角色" onClick={() => onDefinition({ ...definition, roles: [...definition.roles, { id: stableId("role", definition.roles.map((role) => role.id)), capabilities: [] }] })}><Plus /></Button></div>
        {definition.roles.map((role) => <div className="wb-role" key={role.id}><Input value={role.id} readOnly aria-label="角色 ID" title="角色 ID 发布后保持稳定" />
          <div className="wb-capabilities">{WORKFLOW_CAPABILITIES.map((capability) => <label key={capability}><Checkbox checked={role.capabilities.includes(capability)} onCheckedChange={(checked) => onDefinition({ ...definition, roles: definition.roles.map((item) => item.id === role.id ? { ...item, capabilities: toggleCapability(item.capabilities, capability, checked === true) } : item) })} />{capability}</label>)}</div></div>)}
      </section>
    </div></>;
}

function ConfigField({ name, value, definition, nodeType, onChange }: { name: string; value: unknown; definition: WorkflowDefinition; nodeType: SafeWorkflowNode["type"]; onChange: (value: unknown) => void }) {
  const label = name.replaceAll(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
  if (name === "roleId" || name === "confirmationNodeId") {
    const options = name === "roleId" ? definition.roles.map((role) => role.id) : definition.nodes.filter((node) => node.type === "human_confirmation").map((node) => node.id);
    return <Field label={label}><select className="wb-select" value={String(value)} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></Field>;
  }
  if (name === "operator") return <Field label={label}><select className="wb-select" value={String(value)} onChange={(event) => onChange(event.target.value)}><option value="equals">equals</option><option value="not_equals">not_equals</option><option value="exists">exists</option></select></Field>;
  if (Array.isArray(value)) return <Field label={label}><Textarea value={value.join("\n")} onChange={(event) => onChange(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} /></Field>;
  const multiline = name === "instruction" || name === "prompt" || name === "request" || name === "reason" || name === "outcome";
  return <Field label={label}>{multiline ? <Textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} /> : <Input value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />}{nodeType === "condition" && name === "value" ? null : null}</Field>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="wb-field"><span>{label}</span>{children}</label>; }

function ReviewPanel({ issues, versions, compare, pending, onCompare, onFocus }: { issues: WorkflowValidationIssue[]; versions: WorkbenchEditorDto["versions"]; compare: Array<{ kind: string; path: string; before?: unknown; after?: unknown }> | null; pending: boolean; onCompare: (before: string, after: string) => void; onFocus: (id: string) => void }) {
  const [before, setBefore] = useState(versions.at(-1)?.id ?? ""); const [after, setAfter] = useState(versions[0]?.id ?? "");
  return <section className="wb-review"><div className="wb-review-block"><div className="wb-pane-heading"><span>验证</span><Badge variant={issues.length ? "destructive" : "outline"}>{issues.length}</Badge></div><div className="wb-issue-list">{issues.length ? issues.map((issue, index) => <button key={`${issue.path}-${index}`} onClick={() => { const match = issue.path.match(/nodes(?:\[\d+\]|\.)([^.\]]+)/); if (match?.[1]) onFocus(match[1]); }}><strong>{issue.code}</strong><span>{issue.path} · {issue.message}</span></button>) : <p>当前没有验证问题</p>}</div></div>
    <div className="wb-review-block"><div className="wb-pane-heading"><span>版本比较</span><GitCompareArrows /></div><div className="wb-compare-controls"><select aria-label="比较起始版本" className="wb-select" value={before} onChange={(e) => setBefore(e.target.value)}>{versions.map((version) => <option key={version.id} value={version.id}>v{version.version}</option>)}</select><ChevronRight /><select aria-label="比较目标版本" className="wb-select" value={after} onChange={(e) => setAfter(e.target.value)}>{versions.map((version) => <option key={version.id} value={version.id}>v{version.version}</option>)}</select><Button variant="outline" size="sm" disabled={!before || !after || pending} onClick={() => onCompare(before, after)}>比较</Button></div>{compare ? <div className="wb-diff-list">{compare.length ? compare.map((change, index) => <div key={`${change.path}-${index}`}><Badge variant="outline">{change.kind}</Badge><code>{change.path}</code></div>) : <p>所选版本没有结构差异</p>}</div> : null}</div></section>;
}

function PublishDialog({ disabled, onPublish }: { disabled: boolean; onPublish: () => void }) {
  return <Dialog><DialogTrigger render={<button type="button" className={buttonVariants({ variant: "outline", size: "sm" })} disabled={disabled} />}><CircleStop />发布</DialogTrigger><DialogContent className="max-w-md rounded-lg" showCloseButton={false}><DialogHeader><DialogTitle>发布不可变版本</DialogTitle><DialogDescription>发布后将创建永久历史版本并更新当前激活版本。历史版本不会被覆盖或硬删除。</DialogDescription></DialogHeader><div className="wb-lifecycle-warning"><ShieldCheck /><span>请确认草稿已经验证，角色、能力与副作用确认节点均符合治理边界。</span></div><DialogFooter><DialogClose render={<button type="button" className={buttonVariants({ variant: "outline" })} />}>取消</DialogClose><DialogClose render={<button type="button" className={buttonVariants()} onClick={onPublish} />}>确认发布</DialogClose></DialogFooter></DialogContent></Dialog>;
}

function AIProposalDialog({ open, instruction, pending, result, stale, onOpenChange, onInstruction, onGenerate, onApply }: {
  open: boolean; instruction: string; pending: boolean; result: AIProposalResult | null; stale: boolean;
  onOpenChange: (open: boolean) => void; onInstruction: (value: string) => void; onGenerate: () => void; onApply: () => void;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="wb-ai-dialog" showCloseButton={!pending}><DialogHeader><DialogTitle>AI 结构化提案</DialogTitle><DialogDescription>AI 只生成受限草稿提案。检查结构差异并显式应用后，仍需单独保存和发布。</DialogDescription></DialogHeader>
    <Field label="希望如何调整工作流"><Textarea maxLength={4000} rows={4} value={instruction} disabled={pending} onChange={(event) => onInstruction(event.target.value)} placeholder="例如：增加评估负责人确认，并在确认后创建行动" /></Field>
    {result && !result.ok ? <div className="wb-ai-error" role="alert"><strong>提案未生成</strong><span>{aiErrorLabel(result.error)}</span>{result.issues?.slice(0, 3).map((issue) => <code key={`${issue.code}-${issue.path}`}>{issue.path} · {issue.message}</code>)}</div> : null}
    {stale ? <div className="wb-ai-error" role="alert"><strong>提案已过期</strong><span>生成提案后本地草稿已改变。请基于当前草稿重新生成。</span></div> : null}
    {result?.ok ? <section className="wb-ai-review"><div className="wb-pane-heading"><span>结构差异</span><Badge variant="outline">{result.changes.length}</Badge></div><div className="wb-ai-diff">{result.changes.length ? result.changes.map((change, index) => <div key={`${change.path}-${index}`}><Badge variant="outline">{change.kind}</Badge><code>{change.path}</code></div>) : <p>提案与当前草稿没有结构差异。</p>}</div></section> : null}
    <DialogFooter><Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>取消</Button>{result?.ok ? <Button disabled={pending || stale} onClick={onApply}><Check />应用到本地草稿</Button> : <Button disabled={pending || !instruction.trim()} onClick={onGenerate}><Sparkles />{pending ? "生成中" : "生成提案"}</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}

function aiErrorLabel(error: AIProposalError): string {
  const labels: Record<string, string> = {
    BUSY: "已有同一用户或组织的 AI 提案正在生成，请等待完成后重试。",
    PROVIDER_UNAVAILABLE: "未配置受支持的 OpenAI 或 Anthropic provider，手工编辑仍可继续。",
    INVALID_INPUT: "当前草稿或请求不符合提案输入要求。", TIMEOUT: "模型响应超时，请稍后重试。",
    GENERATION_FAILED: "模型调用失败，请稍后重试。", INVALID_SCHEMA: "模型没有返回严格结构化结果。",
    LIMIT_EXCEEDED: "提案超过工作流资源限制。", COMPILER_REJECTED: "提案未通过安全工作流编译校验。",
  };
  return labels[String(error)] ?? "提案未完成。";
}

function toggleCapability(capabilities: WorkflowCapability[], capability: WorkflowCapability, checked: boolean): WorkflowCapability[] { return checked ? [...new Set([...capabilities, capability])] : capabilities.filter((item) => item !== capability); }

function createNode(type: SafeWorkflowNode["type"], id: string, definition: WorkflowDefinition): SafeWorkflowNode {
  const roleId = definition.roles[0]?.id ?? "operator"; const confirmationNodeId = definition.nodes.find((node) => node.type === "human_confirmation")?.id ?? "confirmation";
  const configs: Record<SafeWorkflowNode["type"], Record<string, unknown>> = {
    structured_evidence_input: { fields: ["field"], roleId }, attachment_input: { allowedMimeTypes: ["application/pdf"], roleId }, ai_extract: { instruction: "Extract evidence", outputFields: ["result"], roleId }, human_confirmation: { prompt: "Confirm", roleId },
    condition: { field: "result", operator: "equals", value: "yes" }, wait_for_role: { roleId, request: "Review" }, raise_tension: { confirmationNodeId, roleId, titleField: "title", descriptionField: "description" }, route_tactical_meeting: { confirmationNodeId, roleId },
    create_project: { confirmationNodeId, roleId, nameField: "name", resultField: "result" }, create_action: { confirmationNodeId, roleId, titleField: "title", acceptanceCriteriaField: "acceptanceCriteria" }, mark_governance_candidate: { confirmationNodeId, roleId, rationaleField: "rationale" }, route_governance_meeting: { confirmationNodeId, roleId }, complete: { outcome: "complete" }, terminate: { reason: "terminated" },
  };
  return { id, type, config: configs[type] } as SafeWorkflowNode;
}
