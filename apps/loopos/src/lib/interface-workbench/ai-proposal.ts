import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, jsonSchema, Output, type LanguageModel } from "ai";

import { WORKFLOW_RESOURCE_LIMITS, validateWorkflowResourceBounds } from "./bounds";
import { canonicalJson, compileWorkflow } from "./compiler";
import { structuralDiff, type StructuralDiff } from "./diff";
import type { EditorLayout } from "./dto";
import type { WorkflowDefinition, WorkflowValidationIssue } from "./protocol";

const MAX_PROMPT_LENGTH = 4_000;
const MAX_DEFINITION_BYTES = 256 * 1024;
const MAX_PROPOSAL_BYTES = 256 * 1024;
const AI_TIMEOUT_MS = 20_000;
type JSONSchema = Exclude<Parameters<typeof jsonSchema>[0], PromiseLike<unknown> | (() => unknown)>;

export type AIProposalError =
  | "BUSY"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_INPUT"
  | "TIMEOUT"
  | "GENERATION_FAILED"
  | "INVALID_SCHEMA"
  | "LIMIT_EXCEEDED"
  | "COMPILER_REJECTED";

export type AIProposalResult =
  | { ok: true; proposal: WorkflowDefinition; changes: StructuralDiff[] }
  | { ok: false; error: AIProposalError; issues?: WorkflowValidationIssue[] };

export type AIProposalRequestToken = { editSequence: number; definitionHash: string };

export function createAIProposalRequestToken(editSequence: number, definition: WorkflowDefinition): AIProposalRequestToken {
  return { editSequence, definitionHash: compileWorkflow(definition).ok ? canonicalJson(definition) : "" };
}

export function isAIProposalCurrent(token: AIProposalRequestToken, editSequence: number, definition: WorkflowDefinition): boolean {
  return token.editSequence === editSequence && token.definitionHash === canonicalJson(definition);
}

export function layoutForAIProposal(proposal: WorkflowDefinition, currentLayout: EditorLayout): EditorLayout {
  return Object.fromEntries(proposal.nodes.flatMap((node) => currentLayout[node.id] ? [[node.id, currentLayout[node.id]]] : []));
}

type GenerateStructured = (input: {
  model: LanguageModel;
  system: string;
  prompt: string;
  timeout: number;
}) => Promise<unknown>;

export async function proposeWorkflowDraft(input: {
  instruction: unknown;
  currentDefinition: unknown;
  env?: NodeJS.ProcessEnv;
  generate?: GenerateStructured;
}): Promise<AIProposalResult> {
  if (typeof input.instruction !== "string" || !input.instruction.trim() || input.instruction.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  if (!withinBytes(input.currentDefinition, MAX_DEFINITION_BYTES)) return { ok: false, error: "LIMIT_EXCEEDED" };
  const current = compileWorkflow(input.currentDefinition);
  if (!current.ok) return { ok: false, error: "INVALID_INPUT", issues: current.issues };

  const model = configuredModel(input.env ?? process.env);
  if (!model) return { ok: false, error: "PROVIDER_UNAVAILABLE" };

  try {
    const generated = await (input.generate ?? generateStructured)({
      model,
      system: SYSTEM_PROMPT,
      prompt: `Requested change:\n${input.instruction.trim()}\n\nCurrent canonical workflow:\n${JSON.stringify(current.snapshot)}`,
      timeout: AI_TIMEOUT_MS,
    });
    if (!withinBytes(generated, MAX_PROPOSAL_BYTES)) return { ok: false, error: "LIMIT_EXCEEDED" };
    const bounds = validateWorkflowResourceBounds(generated);
    if (bounds.length) return { ok: false, error: "LIMIT_EXCEEDED", issues: bounds };
    const compiled = compileWorkflow(generated);
    if (!compiled.ok) return { ok: false, error: "COMPILER_REJECTED", issues: compiled.issues };
    const changes = structuralDiff(current.snapshot, compiled.snapshot).filter((change) => canonicalJson(change.before) !== canonicalJson(change.after));
    return { ok: true, proposal: compiled.snapshot, changes };
  } catch (error) {
    if (isTimeout(error)) return { ok: false, error: "TIMEOUT" };
    if (isSchemaFailure(error)) return { ok: false, error: "INVALID_SCHEMA" };
    return { ok: false, error: "GENERATION_FAILED" };
  }
}

function configuredModel(env: NodeJS.ProcessEnv): LanguageModel | null {
  const provider = env.AI_PROVIDER ?? (env.OPENAI_API_KEY ? "openai" : env.ANTHROPIC_API_KEY ? "anthropic" : "");
  if (provider === "openai" && env.OPENAI_API_KEY) {
    return createOpenAI({ apiKey: env.OPENAI_API_KEY })(env.AI_MODEL ?? "gpt-4o-mini");
  }
  if (provider === "anthropic" && env.ANTHROPIC_API_KEY) {
    return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(env.AI_MODEL ?? "claude-sonnet-4-20250514");
  }
  return null;
}

async function generateStructured(input: { model: LanguageModel; system: string; prompt: string; timeout: number }): Promise<unknown> {
  const result = await generateText({
    model: input.model,
    system: input.system,
    prompt: input.prompt,
    output: Output.object({ schema: workflowSchema }),
    maxOutputTokens: 8_000,
    maxRetries: 1,
    timeout: input.timeout,
  });
  return result.output;
}

const SYSTEM_PROMPT = `You prepare a complete LoopOS workflow proposal using only the supplied safe-node schema.
Return one complete definition. Preserve stable IDs where an existing node or role is retained.
Never include URLs, tools, plugins, downloads, code, scripts, or instructions to execute external actions.
Every side-effect node must remain behind an explicit human_confirmation node and satisfy the workflow compiler.`;

const string = (maxLength: number = WORKFLOW_RESOURCE_LIMITS.stringLength): JSONSchema => ({ type: "string", minLength: 1, maxLength });
const stringArray: JSONSchema = { type: "array", items: string(512), maxItems: WORKFLOW_RESOURCE_LIMITS.arrayLength };
const roleConfig = (properties: Record<string, JSONSchema>, required: string[]): JSONSchema => ({
  type: "object", additionalProperties: false, properties, required,
});
const node = (type: string, config: JSONSchema): JSONSchema => ({
  type: "object", additionalProperties: false,
  properties: { id: string(128), type: { const: type }, config }, required: ["id", "type", "config"],
});
const confirmation: Record<string, JSONSchema> = { confirmationNodeId: string(128), roleId: string(128) };

const workflowJsonSchema: JSONSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    protocolVersion: { const: 1 }, definitionSchemaVersion: { const: 1 }, name: string(256), entryNodeId: string(128),
    roles: { type: "array", maxItems: WORKFLOW_RESOURCE_LIMITS.roles, items: { type: "object", additionalProperties: false, properties: { id: string(128), capabilities: { type: "array", uniqueItems: true, items: { enum: ["collect_evidence", "use_ai", "confirm", "route", "create_project", "create_action", "raise_tension", "governance"] } } }, required: ["id", "capabilities"] } },
    nodes: { type: "array", minItems: 1, maxItems: WORKFLOW_RESOURCE_LIMITS.nodes, items: { oneOf: [
      node("structured_evidence_input", roleConfig({ fields: stringArray, roleId: string(128) }, ["fields", "roleId"])),
      node("attachment_input", roleConfig({ allowedMimeTypes: stringArray, roleId: string(128) }, ["allowedMimeTypes", "roleId"])),
      node("ai_extract", roleConfig({ instruction: string(2000), outputFields: stringArray, roleId: string(128) }, ["instruction", "outputFields", "roleId"])),
      node("human_confirmation", roleConfig({ prompt: string(2000), roleId: string(128) }, ["prompt", "roleId"])),
      node("condition", roleConfig({ field: string(512), operator: { enum: ["equals", "not_equals", "exists"] }, value: { type: ["string", "number", "boolean"] } }, ["field", "operator"])),
      node("wait_for_role", roleConfig({ roleId: string(128), request: string(2000) }, ["roleId", "request"])),
      node("raise_tension", roleConfig({ ...confirmation, titleField: string(512), descriptionField: string(512) }, ["confirmationNodeId", "roleId", "titleField", "descriptionField"])),
      node("route_tactical_meeting", roleConfig(confirmation, ["confirmationNodeId", "roleId"])),
      node("create_project", roleConfig({ ...confirmation, nameField: string(512), resultField: string(512) }, ["confirmationNodeId", "roleId", "nameField", "resultField"])),
      node("create_action", roleConfig({ ...confirmation, titleField: string(512), acceptanceCriteriaField: string(512) }, ["confirmationNodeId", "roleId", "titleField", "acceptanceCriteriaField"])),
      node("mark_governance_candidate", roleConfig({ ...confirmation, rationaleField: string(512) }, ["confirmationNodeId", "roleId", "rationaleField"])),
      node("route_governance_meeting", roleConfig(confirmation, ["confirmationNodeId", "roleId"])),
      node("complete", roleConfig({ outcome: string(2000) }, ["outcome"])),
      node("terminate", roleConfig({ reason: string(2000) }, ["reason"])),
    ] } },
    edges: { type: "array", maxItems: WORKFLOW_RESOURCE_LIMITS.edges, items: { type: "object", additionalProperties: false, properties: { id: string(128), from: string(128), to: string(128), branch: { enum: ["true", "false"] } }, required: ["id", "from", "to"] } },
    editor: { type: "object", additionalProperties: false, properties: { description: string(2000) } },
  },
  required: ["protocolVersion", "definitionSchemaVersion", "name", "entryNodeId", "roles", "nodes", "edges"],
};

const workflowSchema = jsonSchema<WorkflowDefinition>(workflowJsonSchema, {
  validate: (value) => {
    const compiled = compileWorkflow(value);
    return compiled.ok ? { success: true, value: compiled.snapshot } : { success: false, error: new Error("Workflow schema validation failed") };
  },
});

function withinBytes(value: unknown, limit: number): boolean {
  try { return Buffer.byteLength(JSON.stringify(value), "utf8") <= limit; } catch { return false; }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || /timeout|timed out/i.test(error.message));
}

function isSchemaFailure(error: unknown): boolean {
  return error instanceof Error && /schema|object|parse|validation/i.test(`${error.name} ${error.message}`);
}
