import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { adoptProposalAction, clarifyProposalAction, createProposalAction, objectProposalAction, withdrawProposalAction } from "./proposal-actions";

const actions = readFileSync(new URL("./proposal-actions.ts", import.meta.url), "utf8");
const workbench = readFileSync(new URL("./governance-workbench.tsx", import.meta.url), "utf8");

describe("RTW1-S3 canonical governance Server Action boundary", () => {
  test("legacy exports remain fail closed", async () => {
    for (const action of [createProposalAction, clarifyProposalAction, objectProposalAction, adoptProposalAction, withdrawProposalAction]) assert.match(String((await action())?.error), /旧流程/);
  });

  test("thin actions derive identity server-side and invoke only the canonical executor", () => {
    assert.match(actions, /getCurrentOrgId\(\), getCurrentPerson\(\)/);
    assert.match(actions, /executeGovernanceDecisionOperation\(input, createPrismaGovernanceDecisionDependencies\(prisma\)\)/);
    assert.doesNotMatch(actions, /governance-engine/);
    assert.match(actions, /provenanceKind === "ORDINARY_TENSION"/);
  });

  test("ordinary initialization rejects fake runtime provenance and binds raiser plus exact governance meeting", () => {
    assert.doesNotMatch(actions, /governanceProposal\.create/);
    assert.doesNotMatch(actions, /\$transaction/);
    assert.match(actions, /provenanceKind: "ORDINARY_TENSION"/);
  });

  test("workbench exposes state-specific canonical actions and four-field objection guidance", () => {
    for (const operation of ["REQUEST_CLARIFICATION", "SUBMIT_REVISION", "RAISE_OBJECTION", "ASSESS_OBJECTION_INVALID", "ASSESS_OBJECTION_VALID", "RECORD_NON_ADOPTION", "ADOPT_ROLE"]) assert.match(workbench, new RegExp(operation));
    for (const field of ["materialHarm", "factVsWorry", "reversibility", "safeToTry"]) assert.match(workbench, new RegExp(field));
    assert.match(workbench, /<Button type="submit"/);
    assert.match(workbench, /operationScope" value={`\$\{operation\.toLowerCase\(\)\}-\$\{key\}`}/);
    assert.match(workbench, /operationScope" value={`assessment-\$\{key\}`}/);
  });
  test("canonical projection remains visible after proposal adoption", () => {
    assert.match(workbench, /p\.governanceDecisionProcess !== null \|\|/);
    assert.doesNotMatch(workbench, /p\.status === "CANDIDATE" && p\.governanceDecisionProcess/);
    assert.match(workbench, /process\.state === "ADOPTED"/);
    assert.match(workbench, /outcomeRoleId/);
    assert.match(workbench, /decisionId/);
    assert.match(workbench, /changeLogId/);
  });

  test("an uninitialized runtime candidate keeps its title and provenance visible", () => {
    assert.match(workbench, /label="待初始化"/);
    assert.match(workbench, /proposal\.sourceTension\.title/);
    assert.match(workbench, />运行来源<\/Link>/);
  });
});
