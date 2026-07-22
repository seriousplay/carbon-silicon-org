import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const createActions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const newForm = readFileSync(new URL("./new-form.tsx", import.meta.url), "utf8");
const detailPage = readFileSync(new URL("./[id]/page.tsx", import.meta.url), "utf8");
const collaborationActions = readFileSync(new URL("./[id]/collaboration-actions.ts", import.meta.url), "utf8");
const collaborationPanel = readFileSync(new URL("./[id]/meeting-collaboration-panel.tsx", import.meta.url), "utf8");
const domainOperations = readFileSync(new URL("../../../lib/domain-operations.ts", import.meta.url), "utf8");

describe("RTW1-S1 meeting collaboration", () => {
  test("meeting creation supports organization-scoped participant selection", () => {
    assert.match(newForm, /name="participantIds"/);
    assert.match(createActions, /formData\.getAll\("participantIds"\)/);
    assert.match(createActions, /organizationId: orgId/);
    assert.match(createActions, /参与人必须属于当前组织/);
    assert.match(createActions, /prisma\.circle\.findFirst/);
    assert.match(createActions, /organizationId: orgId, status: \{ not: "ARCHIVED" \}/);
    assert.match(createActions, /所属回路必须属于当前组织/);
    assert.match(createActions, /participants: \{ connect: participantIds\.map/);
  });

  test("participant maintenance is visible on meeting detail and keeps current participant authority", () => {
    assert.match(detailPage, /MeetingCollaborationPanel/);
    assert.match(collaborationPanel, /保存参与人/);
    assert.match(collaborationActions, /updateMeetingParticipantsAction/);
    assert.match(collaborationActions, /if \(!participantIds\.includes\(personId\)\) participantIds\.push\(personId\)/);
    assert.match(collaborationActions, /participants: \{ set: participantIds\.map/);
  });

  test("shared notes use optimistic revision conflict detection", () => {
    assert.match(collaborationPanel, /name="notesRevision"/);
    assert.match(collaborationActions, /updateMeetingNotes\(tx/);
    assert.match(domainOperations, /notesRevision: input\.expectedNotesRevision/);
    assert.match(domainOperations, /notesRevision: \{ increment: 1 \}/);
    assert.match(collaborationActions, /MEETING_NOTES_STALE/);
  });

  test("nonparticipants cannot update notes or end meetings and participants can complete", () => {
    assert.match(collaborationActions, /只有当前会议参与人可以执行此操作/);
    assert.match(collaborationActions, /updateMeetingNotesAction/);
    assert.match(collaborationActions, /endMeetingAction/);
    assert.match(collaborationActions, /endedAt: new Date\(\)/);
    assert.match(collaborationActions, /endedById: personId/);
  });

  test("participant updates notify only newly added members inside the meeting transaction", () => {
    assert.match(collaborationActions, /newlyAddedIds/);
    assert.match(collaborationActions, /notifyMeetingParticipants/);
    assert.match(collaborationActions, /recipientIds: newlyAddedIds/);
    assert.match(collaborationActions, /prisma\.\$transaction/);
  });
});
