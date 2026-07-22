# G3-I2C-GD1 Governance Decision and Typed Structure Application Implementation Plan

Date: 2026-07-11

Status: implementation plan only; implementation inactive

Source of truth: `GOALS.md` G3-I2C-GD1 and `docs/plans/2026-07-11-gd1-governance-decision-design.md`

## 1. Outcome and locked boundary

Implement one browser-verifiable path for an exactly routed generic `GovernanceProposal(status = "CANDIDATE")`: the immutable original proposer authors complete revisions; actual current participants of the exact selected governance meeting record process results; only adoption of a `READY` revision creates exactly one unassigned same-organization `HOME` role, one `DecisionRecord`, one `ChangeLog`, one verified `ROLE` artifact, ordered append-only events, and one atomic source-tension resolution.

The plan does not activate implementation. It introduces no product policy beyond the approved design. In particular it excludes I2C-3, second-interface migration, Data -> Pretraining product changes, pilot weekly-route changes, notifications/outbox, role assignment, a second structure category, and broad governance-engine or tactical-outcome refactoring.

The coordinator-owned GOALS wording correction is assumed to read “zero-write denial”; this plan does not edit GOALS and consistently requires denial before any write.

## 2. Current code map and exact anchors

| Concern | Current file and symbol | Implementation consequence |
|---|---|---|
| Generic candidate authoring | `src/lib/domain-operations.ts` — `authorizeGovernanceCandidateAuthor`, `createGovernanceCandidate` | Preserve runtime candidate creation. GD1 starts only after exact routing and does not give runtime decision authority. |
| Exact candidate/route provenance | `src/lib/domain-operations.ts` — `resolveGovernanceCandidateArtifact`, `authorizeGovernanceRouteReplay`, `resolveGovernanceCandidatesRoutedToMeeting`, private `resolveGovernanceCandidateContext` | Extract one transaction-compatible resolver here. Keep strict command, node, visit, run, relation suffix, metadata, proposer, source tension, meeting type, and tenant equality. Add a process/revision-backed terminal mode; do not weaken the current `CANDIDATE` resolver. |
| Existing proposal identity | `prisma/schema.prisma` — `GovernanceProposal` | Reuse identity, tension, meeting, decision, and legacy status fields. Add reverse relation(s) only; the six-state machine belongs to the new process model. |
| Current meeting authority | `prisma/schema.prisma` — `Meeting.participants`; `src/app/app/meetings/[id]/page.tsx` — `MeetingDetailPage` | The exact current participant relation is the only result-recording authority. Pass `currentPersonId`, `isMeetingParticipant`, and process data to the generic candidate card. |
| Current read-only generic candidate | `src/app/app/meetings/[id]/governance-workbench.tsx` — `GovernanceWorkbench`, `GenericCandidateCard` | Replace only the exactly routed generic card with GD1 controls and trace; keep legacy `ProposalCard` separate. |
| Legacy direct writes | `src/app/app/meetings/[id]/proposal-actions.ts` — `createProposalAction`, `adoptProposalAction`, `objectProposalAction` | Add server-authoritative tenant, exact meeting/type/participant, provenance, status, and process guards. Exported action tests must prove zero-write rejection. |
| Legacy untyped mutation | `src/lib/governance-engine.ts` — `adoptProposal` | Never call it for GD1. Prefer leaving it unchanged; edit only if a transaction-client role-creation helper can be extracted without changing legacy behavior. |
| Existing role form | `src/app/app/circles/[id]/roles/actions.ts` — `createRoleAction` | Reuse its field vocabulary only. Do not call it from GD1 because it owns session, redirect, and a non-composable transaction. |
| Role target and result | `prisma/schema.prisma` — `Circle`, `RoleDef`, `CircleStatus`, `RoleCategory`, `RoleOwnershipType`, `RoleStatus` | Accept only same-tenant `NORMAL`/`WARNING`; deny `HALTED`/`ARCHIVED`; create fixed `HOME`, default `ACTIVE`, and no assignees or contract. |
| Decision and audit | `prisma/schema.prisma` — `DecisionRecord`, `ChangeLog`; `src/app/app/governance/page.tsx` — `GovernancePage` | Reuse outcome records. For GD1 leave `decisionMakerId` null, set meeting authority, use proposer as `ChangeLog.initiator`, and display meeting/proposer/recorder separately. |
| Runtime event/audit | `prisma/schema.prisma` — `InterfaceWorkflowRunEvent`; `prisma/migrations/20260710230000_g3_i2c_runtime_foundation/migration.sql` — `interface_workflow_run_events_reject_mutation` | Reuse ordered append-only events; lock the run while allocating sequence. Do not update/delete event rows. |
| Runtime result artifact | `prisma/schema.prisma` — `InterfaceWorkflowArtifact`, `InterfaceWorkflowArtifactType` | Add only `ROLE`; bind role/process/proposal/revision/meeting/proposer/recorder/run/source/proposal/route artifact/decision/change IDs. |
| Run verification and display | `src/app/app/interfaces/runs/[runId]/page.tsx` — `verifiedArtifacts`, `eventSummary`; `run-workspace.tsx` — `RunWorkspace`, `eventLabel`, `artifactTypeLabel` | Verify `ROLE` metadata against durable state before showing it. The run page remains trace-only and gains no governance controls. |
| Serializable precedent | `src/app/app/meetings/[id]/tactical-outcome-actions.ts` — `submitTacticalOutcomeProposalAction`, `recordTacticalOutcomeDecisionAction`, `appendEvents`, `findExactRoute`, `revalidateStoredRoute` | Reuse the `Serializable`, `FOR UPDATE`, participant revalidation, conditional claim, event sequencing, and exact-route patterns, not tactical types or modules. |
| Session/permission boundary | `src/lib/session.ts` — `getCurrentOrgId`, `getCurrentPerson`; `src/lib/permissions.ts` — `requireOrgAdmin`, `requireCircleLead`, `requirePilotInterfacePermission` | Thin Server Actions resolve the authenticated tenant/person. Admin, lead, coach, interface support, affected holder, and runtime titles never grant GD1 authority. No new generic override helper is added. |

## 3. Locked persistence contract

### 3.1 Prisma additions

Add these enums with the exact bounded values:

- `GovernanceDecisionProcessState`: `READY`, `CLARIFICATION_REQUIRED`, `OBJECTION_PENDING`, `AMENDMENT_REQUIRED`, `NOT_ADOPTED`, `ADOPTED`.
- `GovernanceProposalRevisionSource`: `INITIAL`, `CLARIFICATION`, `AMENDMENT`; a revision after non-adoption uses `AMENDMENT` and is distinguished by immutable prior state/event history.
- `GovernanceDecisionOperationKind`: `INITIALIZE`, `SUBMIT_REVISION`, `REQUEST_CLARIFICATION`, `RAISE_OBJECTION`, `ASSESS_OBJECTION`, `RECORD_NON_ADOPTION`, `ADOPT_ROLE`.
- `GovernanceDecisionOperationStatus`: `PROCESSING`, `FAILED`, `SUCCEEDED`.
- Extend `InterfaceWorkflowArtifactType` with `ROLE` only.

Add `GovernanceDecisionProcess`, `GovernanceProposalRevision`, and `GovernanceDecisionOperation` with the fields and relations locked by design Sections 9 and 16. Names may be adjusted only where Prisma requires a relation disambiguator; semantic fields may not be dropped or merged.

Required model-level uniqueness/indexes:

- process unique proposal identity and tenant-safe composites for proposal, source tension, run, meeting, all three source artifacts, proposer, current revision, recorder, role, decision, and change log;
- revision unique `(processId, revision)` and `(proposalId, revision)`, with tenant-safe composite ownership and positive revision;
- operation globally unique immutable `mutationKey`, plus unique logical slot `(organizationId, proposalId, meetingId, revision, operation, operationScope)`;
- operation status/lease and process organization/meeting/state indexes;
- unique process outcome role/decision/change-log links.

### 3.2 Migration-only database enforcement

The migration must add PostgreSQL checks and triggers that Prisma cannot express:

1. `GovernanceDecisionProcess.currentRevision` is positive; state, active clarification/objection, recorder, and terminal outcome fields form only valid combinations; provenance columns are immutable; application attempts never decrease.
2. Process initialization inserts the process with `currentRevision = 1` and `currentRevisionId = NULL`, inserts revision 1, then links it in the same interactive transaction. A `DEFERRABLE INITIALLY DEFERRED` constraint trigger rejects commit if the pointer is null or the referenced revision differs in organization, process, proposal, or revision number.
3. Proposal revisions reject `UPDATE` and `DELETE`; revision number is positive and snapshots are complete.
4. Operation organization/proposal/process-or-explicit-init-null/meeting/actor/revision/kind/scope/key/hash bindings reject mutation and deletion. Allowed changes are lease-owned `PROCESSING -> SUCCEEDED`, lease-owned `PROCESSING -> FAILED`, same-key `FAILED -> PROCESSING`, or expired same-key `PROCESSING` reclaim with rotated token and incremented attempt.
5. `SUCCEEDED` requires immutable `resultEnvelope`; `FAILED` requires bounded `failureCode`; incompatible envelope/error/lease combinations are rejected.
6. Existing proposal, decision, change, run, event, artifact, tension, meeting, circle, and role rows are untouched. No historical candidate is initialized by migration.

The migration ends with executable reverse SQL as comment-prefixed lines under `-- Reviewed rollback (execute in this reverse order):`. Reverse SQL removes GD1 triggers/functions/tables/constraints/indexes in dependency order and rebuilds `InterfaceWorkflowArtifactType` without `ROLE` only after disposable-fixture `ROLE` artifacts are removed. It must not delete roles or pre-GD1 rows.

## 4. Authority and zero-write matrix

All checks below execute inside the claim/replay transaction before any operation insert, logical-slot reservation, reclaim, or ledger update. UI visibility is advisory only.

| Actor at mutation time | Author revision 1 / clarified / amended / post-non-adoption revision | Request clarification / raise objection / assess / non-adopt / adopt | Replay revision operation | Replay meeting-result operation |
|---|---:|---:|---:|---:|
| Immutable original proposer, current exact-meeting participant | Allow | Allow | Allow | Allow |
| Immutable original proposer, no longer current participant | Allow | Deny | Allow | Deny |
| Other current exact-meeting participant | Deny | Allow | Deny | Allow only their exact bound operation |
| Same-organization nonparticipant | Deny | Deny | Deny | Deny |
| Former participant who is not proposer | Deny | Deny | Deny | Deny |
| Admin/coach/circle lead/interface support/affected holder by title only | Deny | Deny | Deny | Deny |
| Runtime/AI/system process without a valid authenticated actor | Deny | Deny | Deny | Deny |
| Cross-tenant person or wrong-meeting participant | Deny | Deny | Deny | Deny |

Every denial, including replay denial, must preserve counts and row images for `GovernanceDecisionOperation`, logical slots, process/revision/event rows, `RoleDef`, `DecisionRecord`, `ChangeLog`, `InterfaceWorkflowArtifact`, proposal status/decision, and tension status/resolution. The mutation key must remain unused after a fresh denied request.

## 5. Six-state transition table

| From | Operation | Actor | To | Required zero-write outcome |
|---|---|---|---|---|
| no process | initialize complete revision 1 | original proposer | `READY` | No structure, decision, change, result artifact, or tension-resolution write |
| `READY` | request clarification | current participant | `CLARIFICATION_REQUIRED` | Same zero-structure set |
| `CLARIFICATION_REQUIRED` | complete revision + 1 | original proposer | `READY` | Same zero-structure set; old revision/event immutable |
| `READY` | raise structured objection | current participant | `OBJECTION_PENDING` | Same zero-structure set |
| `OBJECTION_PENDING` | assess invalid | current participant | `READY`, same revision | Same zero-structure set; objection/assessment remain in history |
| `OBJECTION_PENDING` | assess valid | current participant | `AMENDMENT_REQUIRED`, same revision | Same zero-structure set; adoption denied |
| `AMENDMENT_REQUIRED` | complete revision + 1 | original proposer | `READY` | Same zero-structure set |
| `READY` or `AMENDMENT_REQUIRED` | non-adopt with note | current participant | `NOT_ADOPTED` | Source tension remains `OPEN`; zero role/decision/change/result artifact/resolution |
| `NOT_ADOPTED` with open tension | complete revision + 1 | original proposer | `READY` | No new proposal/route/outcome/structure/resolution; prior result immutable |
| `READY` | adopt current revision | current participant | `ADOPTED` | Exactly one atomic `ROLE_CREATED` outcome; tension resolves |
| `ADOPTED` | any non-replay operation | anyone | denied | Global zero writes |

Clarification and objection payloads are bounded structured JSON. Objections include material harm/regression, fact-versus-worry, reversibility, and safe-to-try fields. Software validates completeness but never decides validity.

## 6. Operation claim, replay, retry, and adoption transaction

Every write uses a canonical payload with stable key order and explicit nulls, hashed together with schema version, organization, proposal, process-or-initialization-null, exact meeting, actor, operation, expected revision, scope, and mutation key.

Claim/replay order:

1. Parse and bound input without writes.
2. In a short transaction, lock tenant-scoped proposal, process when present, current/historical revision as applicable, exact route/meeting, and current participant relation.
3. Re-resolve immutable candidate/route provenance and authorize the operation-specific actor.
4. Read the key/logical slot without changing it. Successful historical replay rechecks current operation-specific authority first, then exact immutable binding; only historical current-revision equality may be ignored.
5. For fresh claim or reclaim, validate current state/revision/payload, then insert or reclaim one `PROCESSING` row. Fresh key against an existing slot is denied forever.
6. Commit the claim before application. All rejected steps leave the ledger untouched.

Successful adoption then runs one `Prisma.TransactionIsolationLevel.Serializable` transaction:

1. Lock operation by exact lease token, process, proposal, current revision, run, and source tension with `FOR UPDATE`.
2. Re-resolve exact tenant/route/meeting/artifact/proposer provenance and current recorder participation.
3. Recompute payload hash; require `READY`, exact current revision, open tension, no outcome, and same-tenant target circle still `NORMAL` or `WARNING`.
4. Conditionally claim the process, then create exactly one `RoleDef` with fixed `HOME`, default `ACTIVE`, no assignee, and no contract.
5. Create one `DecisionRecord(type = ROLE_CHANGE, decisionMakerId = null, meetingId = exact meeting)` and connect the source tension as both related and resolved.
6. Create one `ChangeLog(type = ROLE_CREATED, beforeValue = "无", initiatorId = immutable proposer)` with canonical after snapshot and decision link.
7. Update the legacy proposal to its compatible adopted representation and attach the decision.
8. Update the process to `ADOPTED` with recorder/time/note, role, decision, and change log.
9. Conditionally update the source tension `OPEN -> RESOLVED` and set `resolvedAt`; require exactly one row.
10. Create one verified `ROLE` artifact, append ordered adoption/application/artifact events while the run is locked, and mark the operation `SUCCEEDED` with the complete immutable result envelope.

Any application error rolls back all ten application effects. A mandatory recovery transaction locks the same claim and unchanged process/revision, marks it `FAILED`, increments the process attempt projection, and appends `COMMAND_FAILED`. If recovery itself fails, the claim stays `PROCESSING`; only exact same-key/binding reclaim after lease expiry may rotate the lease and increment attempt. A fresh key never retries that slot.

## 7. Sequential implementation slices

Only one slice is active at a time. Each slice uses the content-complete baseline and patch protocol below before its first edit and freezes its own delta before the next slice starts. Do not edit `GOALS.md` or `progress-dashboard.html` in any implementation slice.

### Mandatory dirty-worktree baseline and own-delta protocol

The current checkout already contains modified and untracked files that overlap future GD1-owned paths. Git status or a tracked-only diff is not a baseline. Before each slice, capture every allowed path exactly as it exists, including tracked modifications, untracked files, generated subtrees, symlinks, modes, and paths that do not yet exist. Artifacts live outside the repository under one disposable root:

```bash
export GD1_BASELINE_ROOT="/tmp/loopos-gd1-baseline-$(date +%s)-$$"
mkdir -p "$GD1_BASELINE_ROOT"
: "${GD1_SESSION_ID:?coordinator must provide one immutable GD1 session identity}"
export GD1_REPO_REALPATH="$(pwd -P)"
export GD1_REPO_KEY="$(printf '%s' "$GD1_REPO_REALPATH" | shasum -a 256 | awk '{print $1}')"
export GD1_LOCK_DIR="/tmp/loopos-gd1-$GD1_REPO_KEY.lock"

acquire_workspace_lock() {
  lock_scope="$1"
  case "$lock_scope" in slice-1|slice-2|slice-3|slice-4|rollback-all) ;;
    *) return 64 ;;
  esac
  if ! mkdir "$GD1_LOCK_DIR" 2>/dev/null; then
    test -f "$GD1_LOCK_DIR/owner" && sed -n '1,20p' "$GD1_LOCK_DIR/owner" >&2
    return 73
  fi
  export GD1_LOCK_SCOPE="$lock_scope"
  export GD1_LOCK_TOKEN="$GD1_SESSION_ID-$lock_scope-$$-$(date +%s)-$RANDOM"
  guardian_log="/tmp/loopos-gd1-lock-guardian-$GD1_REPO_KEY.log"
  nohup sh -c '
    lock_dir=$1
    token=$2
    authorized_release=0
    cleanup() {
      if test "$authorized_release" -eq 1; then
        chmod u+w "$lock_dir/owner" 2>/dev/null || true
        rm -f "$lock_dir/release.request" "$lock_dir/owner"
        rmdir "$lock_dir" 2>/dev/null || true
      fi
    }
    trap cleanup EXIT
    trap "exit 1" HUP INT TERM
    while :; do
      if test -f "$lock_dir/release.request"; then
        request=$(sed -n "1p" "$lock_dir/release.request")
        if test "$request" = "$token"; then
          authorized_release=1
          exit 0
        fi
      fi
      sleep 1
    done
  ' sh "$GD1_LOCK_DIR" "$GD1_LOCK_TOKEN" > "$guardian_log" 2>&1 &
  guardian_pid=$!
  printf '%s\n' \
    "repo_realpath=$GD1_REPO_REALPATH" \
    "repo_key=$GD1_REPO_KEY" \
    "session_id=$GD1_SESSION_ID" \
    "lock_scope=$GD1_LOCK_SCOPE" \
    "owner_pid=$$" \
    "guardian_pid=$guardian_pid" \
    "token=$GD1_LOCK_TOKEN" \
    "acquired_at=$(date +%s)" \
    > "$GD1_LOCK_DIR/owner"
  chmod 0444 "$GD1_LOCK_DIR/owner"
  require_workspace_lock "$lock_scope"
}

require_workspace_lock() {
  expected_scope="$1"
  test -d "$GD1_LOCK_DIR"
  test -f "$GD1_LOCK_DIR/owner"
  test "$(grep -Fxc "repo_realpath=$GD1_REPO_REALPATH" "$GD1_LOCK_DIR/owner")" -eq 1
  test "$(grep -Fxc "repo_key=$GD1_REPO_KEY" "$GD1_LOCK_DIR/owner")" -eq 1
  test "$(grep -Fxc "session_id=$GD1_SESSION_ID" "$GD1_LOCK_DIR/owner")" -eq 1
  test "$(grep -Fxc "lock_scope=$expected_scope" "$GD1_LOCK_DIR/owner")" -eq 1
  owner_token=$(sed -n 's/^token=//p' "$GD1_LOCK_DIR/owner")
  test -n "$owner_token"
  if test -n "${GD1_LOCK_TOKEN:-}"; then test "$owner_token" = "$GD1_LOCK_TOKEN"; fi
  export GD1_LOCK_TOKEN="$owner_token"
  guardian_pid=$(sed -n 's/^guardian_pid=//p' "$GD1_LOCK_DIR/owner")
  test -n "$guardian_pid"
  kill -0 "$guardian_pid" 2>/dev/null
  test "$(pwd -P)" = "$GD1_REPO_REALPATH"
}

run_locked_mutation() {
  expected_scope="$1"
  shift
  require_workspace_lock "$expected_scope"
  "$@"
}

integrate_slice_patch() {
  expected_scope="$1"
  patch_path="$2"
  require_workspace_lock "$expected_scope"
  git apply --check -p2 "$patch_path"
  require_workspace_lock "$expected_scope"
  git apply -p2 "$patch_path"
}

release_workspace_lock() {
  expected_scope="$1"
  require_workspace_lock "$expected_scope"
  printf '%s\n' "$GD1_LOCK_TOKEN" > "$GD1_LOCK_DIR/release.request.tmp.$$"
  mv "$GD1_LOCK_DIR/release.request.tmp.$$" "$GD1_LOCK_DIR/release.request"
  attempts=0
  while test -d "$GD1_LOCK_DIR" && test "$attempts" -lt 100; do
    sleep 0.1
    attempts=$((attempts + 1))
  done
  test ! -e "$GD1_LOCK_DIR"
  unset GD1_LOCK_SCOPE GD1_LOCK_TOKEN
}

begin_slice() {
  export BASE="$GD1_BASELINE_ROOT/slice-$1"
  test ! -e "$BASE"
  mkdir -p "$BASE"
  : > "$BASE/owned-paths"
}

snapshot_owned() {
  label="$1"
  root="$BASE/$label"
  test ! -e "$root"
  mkdir -p "$root"
  : > "$BASE/$label.absent"
  : > "$BASE/$label.existing"
  while IFS= read -r path; do
    test -n "$path" || continue
    if test -e "$path" || test -L "$path"; then
      printf '%s\n' "$path" >> "$BASE/$label.existing"
      rsync -aR "$path" "$root/"
    else
      printf '%s\n' "$path" >> "$BASE/$label.absent"
    fi
  done < "$BASE/owned-paths"
  (cd "$root" && find . -print | LC_ALL=C sort) > "$BASE/$label.tree"
  (cd "$root" && find . -type f -exec shasum -a 256 {} \; | LC_ALL=C sort -k 2) > "$BASE/$label.sha256"
  (cd "$root" && find . -type l -exec sh -c 'for p do printf "%s -> %s\n" "$p" "$(readlink "$p")"; done' sh {} + | LC_ALL=C sort) > "$BASE/$label.symlinks"
  (cd "$root" && find . -exec stat -f '%p %N' {} \; | LC_ALL=C sort -k 2) > "$BASE/$label.modes"
  tar -C "$BASE" -cf "$BASE/$label.tar" "$label" "$label.absent" "$label.existing" "$label.tree" "$label.sha256" "$label.symlinks" "$label.modes"
  shasum -a 256 "$BASE/$label.tar" > "$BASE/$label.tar.sha256"
}

close_slice() {
  require_workspace_lock "$1"
  snapshot_owned after
  set +e
  (cd "$BASE" && git diff --no-index --binary -- before after) > "$BASE/own-delta.patch"
  diff_status=$?
  set -e
  test "$diff_status" -eq 1
  test -s "$BASE/own-delta.patch"
  git apply --check -R -p2 "$BASE/own-delta.patch"
  shasum -a 256 "$BASE/own-delta.patch" > "$BASE/own-delta.patch.sha256"
}

assert_exact_owned_path() {
  path="$1"
  repo_root=$(pwd -P)
  case "$path" in
    ""|/*|.|..|../*|*/../*|*/..) return 1 ;;
  esac
  test "$(grep -Fxc -- "$path" "$BASE/owned-paths")" -eq 1
  parent=$(cd "$(dirname "$path")" && pwd -P)
  case "$parent" in
    "$repo_root"|"$repo_root"/*) ;;
    *) return 1 ;;
  esac
}

remove_baseline_missing_path() {
  path="$1"
  require_workspace_lock rollback-all
  assert_exact_owned_path "$path"
  grep -Fxq -- "$path" "$BASE/before.absent"
  if test -d "$path" && ! test -L "$path"; then
    rm -rf -- "$path"
  else
    rm -f -- "$path"
  fi
  test ! -e "$path" && test ! -L "$path"
}

restore_baseline_existing_path() {
  path="$1"
  require_workspace_lock rollback-all
  assert_exact_owned_path "$path"
  grep -Fxq -- "$path" "$BASE/before.existing"
  source_path="$BASE/restore-media/before/$path"
  test -e "$source_path" || test -L "$source_path"
  mkdir -p "$(dirname "$path")"
  rsync -a --delete "$source_path" "$(dirname "$path")/"
}

rollback_slice_locked() {
  require_workspace_lock rollback-all
  export BASE="$GD1_BASELINE_ROOT/slice-$1"
  shasum -a 256 -c "$BASE/before.tar.sha256"
  shasum -a 256 -c "$BASE/after.tar.sha256"
  shasum -a 256 -c "$BASE/own-delta.patch.sha256"
  snapshot_owned rollback-current
  for suffix in absent existing tree sha256 symlinks modes; do
    diff -u "$BASE/after.$suffix" "$BASE/rollback-current.$suffix"
  done
  git apply --check -R -p2 "$BASE/own-delta.patch"
  test ! -e "$BASE/restore-media"
  mkdir -p "$BASE/restore-media"
  tar -xpf "$BASE/before.tar" -C "$BASE/restore-media" before
  require_workspace_lock rollback-all
  snapshot_owned rollback-revalidated
  for suffix in absent existing tree sha256 symlinks modes; do
    diff -u "$BASE/after.$suffix" "$BASE/rollback-revalidated.$suffix"
  done
  while IFS= read -r path; do
    test -n "$path" || continue
    if grep -Fxq -- "$path" "$BASE/before.absent"; then
      remove_baseline_missing_path "$path"
    else
      restore_baseline_existing_path "$path"
    fi
  done < "$BASE/owned-paths"
  snapshot_owned restored
  for suffix in absent existing tree sha256 symlinks modes; do
    diff -u "$BASE/before.$suffix" "$BASE/restored.$suffix"
  done
}

rollback_lock_exit() {
  rollback_status=$?
  trap - EXIT
  if test "$rollback_status" -eq 0; then
    release_workspace_lock rollback-all
  else
    printf '%s\n' "rollback failed closed; lock and archives retained for coordinator reconciliation" >&2
  fi
  exit "$rollback_status"
}

rollback_all_slices() (
  set -e
  acquire_workspace_lock rollback-all
  trap rollback_lock_exit EXIT
  trap 'exit 130' HUP INT TERM
  rollback_slice_locked 4
  rollback_slice_locked 3
  rollback_slice_locked 2
  rollback_slice_locked 1
)

rollback_one_slice() (
  set -e
  slice_number="$1"
  case "$slice_number" in 1|2|3|4) ;; *) exit 64 ;; esac
  acquire_workspace_lock rollback-all
  trap rollback_lock_exit EXIT
  trap 'exit 130' HUP INT TERM
  rollback_slice_locked "$slice_number"
)
```

`mkdir "$GD1_LOCK_DIR"` is the macOS-supported atomic exclusion primitive; `flock` is unsupported and prohibited. The coordinator assigns one immutable `GD1_SESSION_ID`, records the immutable repository realpath/key and slice identity in `owner`, and must not authorize any parallel worker that can touch a GD1-owned path. Lock contention returns 73 and every worker fails closed. There is no TTL, PID-age heuristic, automatic steal, or automatic stale-lock deletion. If the guardian is dead or metadata is suspect, the lock remains in place: only the coordinator may provide recorded proof that the recorded owner and guardian are both dead, no worker or mutation is in flight, the repository realpath matches, and owned paths have been manually reconciled to an archive manifest before quarantining that exact lock directory and authorizing a new session. A worker may never perform that recovery itself.

Each slice starts by acquiring `slice-N` before `begin_slice`, holds that same lock continuously through baseline capture, every test/code/generate/migration-file write or patch integration, verification, post-state capture, and own-delta creation, and releases it only after `close_slice N` succeeds. Every mutation command must be invoked through `run_locked_mutation slice-N ...`; a prepared patch must use `integrate_slice_patch slice-N PATCH`, and a non-shell editing tool must be preceded immediately by `require_workspace_lock slice-N` in the same serialized worker session. Re-run `require_workspace_lock slice-N` immediately before every mutation. The lock guardian—not the lifetime of one shell invocation—holds exclusion between commands, while immutable owner metadata lets the same authorized session revalidate it. Any owned-path edit outside this protocol, including an editor, formatter, generator, or parallel worker, invalidates the post-state/rollback proof: stop, preserve the lock and archives, and require coordinator-led manual reconciliation; never overwrite that edit.

For each slice, while its lock is held, write the exact allowed path list shown below to `$BASE/owned-paths` only after the immediately preceding `require_workspace_lock slice-N`; then revalidate the lock and run `snapshot_owned before`. The immutable, checksummed `before.tar` plus manifests are the actual restoration medium. `own-delta.patch` remains scope/concurrency evidence and an optional forward handoff for a baseline-identical checkout; it is never the rollback medium. At slice close, retain the before/after archives, manifests, patch, and checksums until product acceptance and cleanup.

Rollback is executable only through `rollback_all_slices`: it atomically acquires `rollback-all` before current-state inspection, installs the release trap, and holds the same lock through 4 -> 3 -> 2 -> 1 validation, archive restore or exact missing-path deletion, and final manifest verification. Each slice first snapshots the complete current owned set and requires exact equality with the captured post-slice `after` absent/existing/tree/content-hash/symlink/POSIX-mode manifests; this and the reverse patch check prove no concurrent divergence beyond the recorded slice delta. Immediately before the first repository mutation it revalidates the lock and captures/compares `rollback-revalidated`; each removal/restore helper revalidates the lock again. Baseline-existing paths are then restored recursively from the verified immutable archive with `rsync -a --delete`, and their type, bytes, symlink targets, and complete numeric POSIX modes must reproduce the baseline manifests exactly. A baseline-missing path may be removed only by `remove_baseline_missing_path`, after proving that it is listed exactly once in the slice owned manifest, listed in `before.absent`, has the captured post-state, resolves under the repository through its real parent, and belongs to the already verified unchanged current slice tree. The function may delete only that exact file/symlink/directory and must immediately verify absence. `git checkout`, `git restore`, `git reset`, broad or unverified deletion, and directory-wide workspace replacement remain prohibited. Any lock, proof, concurrent-edit, or restored-manifest mismatch stops rollback without fallback or overwrite.

### Slice 1 — Additive persistence foundation (recommended first delegation)

**Goal**

Create an inert, database-enforced persistence contract with no reachable product behavior and no change to existing pages/actions.

**Allowed files**

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_g3_i2c_gd1_governance_decision/migration.sql`
- generated `src/generated/prisma/**` only via `./node_modules/.bin/prisma generate`
- new `src/lib/interface-workbench/__tests__/governance-decision-persistence.test.ts`

**Forbidden in this slice**

All domain services, Server Actions, pages/components, fixtures, legacy engine/actions, pilot/tactical files, roadmap/dashboard, package/config files, and database seed data.

**Slice baseline**

Choose the final migration directory name before any edit, then capture the exact Slice 1 set:

```bash
export GD1_MIGRATION_DIR="prisma/migrations/<timestamp>_g3_i2c_gd1_governance_decision"
acquire_workspace_lock slice-1
begin_slice 1
require_workspace_lock slice-1
printf '%s\n' \
  prisma/schema.prisma \
  "$GD1_MIGRATION_DIR" \
  src/generated/prisma \
  src/lib/interface-workbench/__tests__/governance-decision-persistence.test.ts \
  > "$BASE/owned-paths"
require_workspace_lock slice-1
snapshot_owned before
```

Replace `<timestamp>` before executing this block. The absent manifest must record the not-yet-created migration/test paths; the generated-client directory is snapshotted recursively, including pre-existing untracked bytes.

**Test first and behavior**

1. Write failing persistence-contract tests for exact enums/models, composites, process/revision/operation constraints, initialization pointer, logical-slot/key uniqueness, immutability/status triggers, `ROLE`, and reviewed reverse SQL.
2. Add Prisma models/relations and additive migration SQL.
3. Prove the process -> revision 1 -> current pointer transaction commits, while null/missing/mismatched pointer commits fail.
4. Prove direct revision update/delete, operation binding/key mutation/delete, illegal status transitions, process provenance mutation, and impossible state/outcome combinations fail at PostgreSQL.
5. Prove migration preserves all pre-GD1 rows and initializes no historical candidate.

**Verification commands**

```bash
./node_modules/.bin/tsx src/lib/interface-workbench/__tests__/governance-decision-persistence.test.ts
./node_modules/.bin/prisma validate
./node_modules/.bin/prisma generate
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint prisma/schema.prisma src/lib/interface-workbench/__tests__/governance-decision-persistence.test.ts
git diff --check -- prisma/schema.prisma prisma/migrations src/generated/prisma src/lib/interface-workbench/__tests__/governance-decision-persistence.test.ts
```

Disposable PostgreSQL apply/rollback/reapply:

```bash
export GD1_DB="loopos_gd1_$(date +%s)"
export GD1_DATABASE_URL="postgresql://127.0.0.1:5432/$GD1_DB"
createdb "$GD1_DB"
DATABASE_URL="$GD1_DATABASE_URL" ./node_modules/.bin/prisma migrate deploy
psql "$GD1_DATABASE_URL" -v ON_ERROR_STOP=1 -c '\d+ governance_decision_processes' -c '\d+ governance_proposal_revisions' -c '\d+ governance_decision_operations' -c "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname IN ('GovernanceDecisionProcessState','GovernanceDecisionOperationStatus','InterfaceWorkflowArtifactType') ORDER BY typname,enumsortorder;"
awk '/^-- Reviewed rollback \(execute in this reverse order\):$/ { emit=1; next } emit && /^-- / { sub(/^-- /, ""); print }' "$GD1_MIGRATION_DIR/migration.sql" | psql "$GD1_DATABASE_URL" -v ON_ERROR_STOP=1
psql "$GD1_DATABASE_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '<timestamp>_g3_i2c_gd1_governance_decision';"
DATABASE_URL="$GD1_DATABASE_URL" ./node_modules/.bin/prisma migrate deploy
```

Replace `<timestamp>` once with the actual migration directory name before executing; no other placeholder is permitted.

**Rollback point**

Before any domain call exists, execute reviewed reverse SQL in the disposable DB, then run `rollback_one_slice 1`. Archive restoration and all restored manifest/hash/mode comparisons must pass; only a strictly proven baseline-missing exact path may be removed. Existing application behavior remains unchanged because the schema is additive and unreachable.

**Completion evidence and dependency**

Run `close_slice slice-1` after all Slice 1 checks, then `release_workspace_lock slice-1`; release is serviced by the guardian's authorized-release `EXIT` trap. Provide test counts, Prisma validate/generate, TypeScript/lint/diff output, catalog inspection, apply/rollback/absence/reapply logs, direct constraint failures, pre-GD1 row-count equality, and the before/after archive plus own-delta checksums. Slice 2 may start only after all pass and release.

**Why this is the first delegation**

This is the lowest-risk boundary because the hardest correctness assumptions—tenant-safe relations, cyclic current-revision initialization, immutable history, durable keys, leases, and impossible-state prevention—become executable before business code depends on them. The migration is additive, initializes no existing candidate, exposes no action, and leaves every current user path unchanged; therefore a partial delivery cannot create a callable but unsafe governance flow.

### Slice 2 — Exact resolver and complete governance domain service

**Goal**

Implement the only authoritative GD1 write boundary, including all six states, operation-specific authority-before-claim/replay, exact provenance, typed `ROLE_CREATED`, serializable adoption, mandatory failure audit, same-key recovery, and terminal replay.

**Allowed files**

- `src/lib/domain-operations.ts`
- new `src/lib/governance-decision.ts`
- `src/lib/governance-engine.ts` only if the tested transaction-client role helper is unavoidable; otherwise unchanged
- new `src/lib/__tests__/governance-decision.test.ts`
- `src/lib/__tests__/domain-operations.test.ts`

**Forbidden in this slice**

Schema/migration/generated client after Slice 1 closes, all Server Actions/UI/fixture files, tactical/pilot behavior, permissions overrides, roadmap/dashboard, and any mutation other than `ROLE_CREATED`.

**Slice baseline**

```bash
acquire_workspace_lock slice-2
begin_slice 2
require_workspace_lock slice-2
printf '%s\n' \
  src/lib/domain-operations.ts \
  src/lib/governance-decision.ts \
  src/lib/governance-engine.ts \
  src/lib/__tests__/governance-decision.test.ts \
  src/lib/__tests__/domain-operations.test.ts \
  > "$BASE/owned-paths"
require_workspace_lock slice-2
snapshot_owned before
```

Snapshot `governance-engine.ts` even if the slice ultimately leaves it unchanged, so optional ownership cannot overwrite its pre-existing dirty content.

**Test first and behavior**

1. Add failing tests for the complete state table, proposer/current-participant matrix, structured objection, full revision snapshots, stale/forged/wrong-tenant/wrong-meeting denials, zero operation rows on denial, historical replay authorization, key/payload/logical-slot binding, concurrency, and failure injection at each adoption step.
2. Extract `resolveRoutedGovernanceCandidateForDecision` (or a mechanically equivalent final name) into `domain-operations.ts`. It returns the verified organization/proposal/tension/proposer/meeting/run/source/proposal/route artifacts/candidate command/route command/revision context and supports initialization, nonterminal actions, and immutable terminal replay without weakening `resolveGovernanceCandidateArtifact`.
3. Implement bounded parsers, canonical JSON/hash, `GovernanceRoleCreatedPayloadV1`, typed domain errors, claim/replay, state transitions, event append, typed role creation, adoption transaction, failure audit, and same-key reclaim in `governance-decision.ts`.
4. Keep session, Next.js, revalidation, redirect, UI, and runtime engine imports out of the service.

**Verification commands**

```bash
./node_modules/.bin/tsx src/lib/__tests__/governance-decision.test.ts
node --import tsx --test src/lib/__tests__/domain-operations.test.ts src/lib/__tests__/tactical-outcome-proposal.test.ts
./node_modules/.bin/tsx 'src/app/app/meetings/[id]/tactical-outcome-actions.test.ts'
./node_modules/.bin/tsx src/lib/interface-workbench/__tests__/governance-decision-persistence.test.ts
./node_modules/.bin/prisma validate
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint src/lib/domain-operations.ts src/lib/governance-decision.ts src/lib/governance-engine.ts src/lib/__tests__/governance-decision.test.ts src/lib/__tests__/domain-operations.test.ts
git diff --check -- src/lib
```

**Rollback point**

Run `rollback_one_slice 2`; after post-state equality proof, it restores baseline-existing paths from the Slice 2 archive and narrowly removes only proven baseline-missing paths, then reproduces every Slice 2 baseline manifest. The Slice 1 result remains intact, inert, and backward compatible; no page or exported action can call the unfinished service.

**Completion evidence and dependency**

Run `close_slice slice-2` after all Slice 2 checks, then `release_workspace_lock slice-2`. Provide transition/authority/idempotency/concurrency/failure-injection test counts, explicit zero-ledger denial assertions, exact terminal replay assertions, `Serializable`/lock evidence, static gates, and own-delta checksum. Slice 3 depends on the service API and stable typed errors and starts only after release.

### Slice 3 — Thin Server Actions and legacy bypass closure

**Goal**

Expose the domain service only through authenticated meeting actions and close all legacy direct-POST paths before GD1 controls become visible.

**Allowed files**

- new `src/app/app/meetings/[id]/governance-decision-actions.ts`
- `src/app/app/meetings/[id]/proposal-actions.ts`
- `src/lib/governance-engine.ts` only for the minimum legacy in-transaction guard required by `adoptProposal`
- new `src/lib/interface-workbench/__tests__/governance-decision-action.test.ts`

**Forbidden in this slice**

Pages/components, run/governance trace UI, fixture, schema/migration, pilot/tactical actions or UI, broad permissions changes, and unrelated legacy refactors.

**Slice baseline**

```bash
acquire_workspace_lock slice-3
begin_slice 3
require_workspace_lock slice-3
printf '%s\n' \
  'src/app/app/meetings/[id]/governance-decision-actions.ts' \
  'src/app/app/meetings/[id]/proposal-actions.ts' \
  src/lib/governance-engine.ts \
  src/lib/interface-workbench/__tests__/governance-decision-action.test.ts \
  > "$BASE/owned-paths"
require_workspace_lock slice-3
snapshot_owned before
```

**Test first and behavior**

1. Write exported action-boundary tests that invoke the actual actions with mocked session/Prisma boundaries, not copied permission logic.
2. Implement dedicated `"use server"` actions for initialization/revision, clarification, objection, assessment, non-adoption, and adoption. Each resolves current organization/person, parses bounded form input, passes exact IDs/revision/key/payload to the domain service, returns only stable UI state, and revalidates literal affected meeting/tension/run/role/circle/governance paths after success.
3. `createProposalAction` permits only same-tenant open ordinary legacy tension, a same-tenant `GOVERNANCE` meeting, current participation, valid same-tenant targets, and no runtime/generic/GD1 provenance.
4. `adoptProposalAction` and `adoptProposal` permit only same-tenant legacy `PROPOSED`, same bound governance meeting, current participation, non-generic provenance, and no process; repeat status/tenant/process guards in the transaction before writes.
5. `objectProposalAction` requires authenticated same-tenant current participation, exact meeting/type, legacy `PROPOSED`, no generic/process provenance, and a required reason; replace the unscoped `update({ id })`.
6. Prove every denial, including title-only identities and replay after participant removal, leaves both domain tables and operation ledger unchanged.

Next.js 16.2.10 constraints from bundled docs:

- keep client-callable actions in a dedicated top-level `"use server"` file;
- authenticate and authorize inside every Server Action even when controls are hidden;
- treat bound and hidden IDs as untrusted input;
- use `useActionState` signatures consistently for form state;
- call `revalidatePath` only in Server Functions and use literal paths for single pages.

**Verification commands**

```bash
./node_modules/.bin/tsx src/lib/interface-workbench/__tests__/governance-decision-action.test.ts
./node_modules/.bin/tsx src/lib/__tests__/governance-decision.test.ts
node --import tsx --test src/lib/__tests__/domain-operations.test.ts src/lib/interface-workbench/__tests__/runtime-governance-route-action.test.ts
./node_modules/.bin/tsx 'src/app/app/meetings/[id]/tactical-outcome-actions.test.ts'
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint 'src/app/app/meetings/[id]/governance-decision-actions.ts' 'src/app/app/meetings/[id]/proposal-actions.ts' src/lib/governance-engine.ts src/lib/interface-workbench/__tests__/governance-decision-action.test.ts
git diff --check -- 'src/app/app/meetings/[id]' src/lib
```

`node --test` does not discover the current bracket-path tactical test when passed that path and can report `0 tests`; the explicit `tsx` command is mandatory.

**Rollback point**

Run `rollback_one_slice 3`; archive restoration must reproduce every pre-existing tracked or untracked byte, type, symlink, and POSIX mode from the Slice 3 baseline. Because no GD1 UI is visible yet, this returns the action surface to the exact post-Slice-2 state.

**Completion evidence and dependency**

Run `close_slice slice-3` after all Slice 3 checks, then `release_workspace_lock slice-3`. Provide actual action-boundary allow/deny/replay counts, unchanged operation/domain counts for each denial, legacy ordinary behavior proof, legacy generic bypass denial, static gates, and own-delta checksum. Slice 4 starts only when no unsafe legacy route remains and the lock is released.

### Slice 4 — Meeting UX, trace projections, fixture, and complete acceptance

**Goal**

Deliver the first usable browser surface and close static, database, browser, regression, review, audit, product-acceptance, and cleanup gates.

**Allowed files**

- `src/app/app/meetings/[id]/page.tsx`
- `src/app/app/meetings/[id]/governance-workbench.tsx`
- `src/app/app/governance/page.tsx`
- `src/app/app/interfaces/runs/[runId]/page.tsx`
- `src/app/app/interfaces/runs/[runId]/run-workspace.tsx`
- new `scripts/g3-i2c-gd1-governance-decision-fixture.ts`
- the three GD1 tests and two existing domain tests named in prior slices, only for missing acceptance assertions

**Forbidden in this slice**

Schema or domain policy changes, Data -> Pretraining source changes, tactical outcome changes, weekly governance-route changes, global styling, notifications, role assignment, another mutation type, I2C-3, second interface, roadmap/dashboard, and unrelated cleanup.

**Slice baseline**

```bash
acquire_workspace_lock slice-4
begin_slice 4
require_workspace_lock slice-4
printf '%s\n' \
  'src/app/app/meetings/[id]/page.tsx' \
  'src/app/app/meetings/[id]/governance-workbench.tsx' \
  src/app/app/governance/page.tsx \
  'src/app/app/interfaces/runs/[runId]/page.tsx' \
  'src/app/app/interfaces/runs/[runId]/run-workspace.tsx' \
  scripts/g3-i2c-gd1-governance-decision-fixture.ts \
  src/lib/__tests__/governance-decision.test.ts \
  src/lib/__tests__/domain-operations.test.ts \
  src/lib/__tests__/tactical-outcome-proposal.test.ts \
  src/lib/interface-workbench/__tests__/governance-decision-persistence.test.ts \
  src/lib/interface-workbench/__tests__/governance-decision-action.test.ts \
  > "$BASE/owned-paths"
require_workspace_lock slice-4
snapshot_owned before
```

**Test first and behavior**

1. Add failing projection/component contract assertions for process data, actor flags, no unauthorized controls, approved wording, complete role payload, history, retry key persistence, result links, role artifact verification, and mobile classes.
2. Extend `MeetingDetailPage` to select exact process/revision/events/operation/result relations tenant-safely; list only `NORMAL`/`WARNING` circles in authoring UI while retaining server denial for forged statuses; pass original-proposer and exact-current-participant flags.
3. Replace only `GenericCandidateCard` with the six-state process card. Show complete revision, source tension/run/meeting, typed role, clarification/objection history, failure/retry, and terminal links. Original proposer sees revision controls even as a former participant; current participants see result controls; proposer sees both only when currently participating; nonparticipants/former non-proposers see none.
4. Use “记录会议澄清请求 / 提出需验证的异议 / 记录异议有效或无效 / 记录会议不采纳 / 记录会议采纳并创建角色”. Never describe the recorder as personally approving.
5. Run page remains read-only and verifies `ROLE` metadata against process/revision/role/decision/change/meeting/exact route before display. Governance page shows “治理会议流程通过” and separates meeting, proposer, recorder, revision, run, artifact, role, and change trace.
6. Fixture creates two organizations and the exact identities/circles/candidates required by design Section 24, supports deterministic application and failure-audit injection, prints retained login/page IDs, and deletes only its own disposable state when explicitly invoked for cleanup.

**Focused and static verification commands**

```bash
./node_modules/.bin/tsx src/lib/__tests__/governance-decision.test.ts
./node_modules/.bin/tsx src/lib/interface-workbench/__tests__/governance-decision-persistence.test.ts
./node_modules/.bin/tsx src/lib/interface-workbench/__tests__/governance-decision-action.test.ts
./node_modules/.bin/prisma validate
./node_modules/.bin/prisma generate
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint prisma/schema.prisma src/lib/domain-operations.ts src/lib/governance-decision.ts src/lib/governance-engine.ts 'src/app/app/meetings/[id]/governance-decision-actions.ts' 'src/app/app/meetings/[id]/proposal-actions.ts' 'src/app/app/meetings/[id]/page.tsx' 'src/app/app/meetings/[id]/governance-workbench.tsx' 'src/app/app/interfaces/runs/[runId]/page.tsx' 'src/app/app/interfaces/runs/[runId]/run-workspace.tsx' src/app/app/governance/page.tsx scripts/g3-i2c-gd1-governance-decision-fixture.ts
./node_modules/.bin/next build
git diff --check
git status --short
```

The focused interface-workbench/Data -> Pretraining regression set is deterministic. At the untouched pre-Slice-1 baseline set `GD1_GATE_PHASE=baseline`; at the final Slice 4 gate set `GD1_GATE_PHASE=final`; then execute the same discovery and per-file runner:

```bash
set -uo pipefail
test "$GD1_GATE_PHASE" = baseline || test "$GD1_GATE_PHASE" = final
export GD1_TEST_EVIDENCE_ROOT="$GD1_BASELINE_ROOT/focused-test-evidence"
mkdir -p "$GD1_TEST_EVIDENCE_ROOT"
PHASE_DIR="$GD1_TEST_EVIDENCE_ROOT/$GD1_GATE_PHASE"
test ! -e "$PHASE_DIR"
mkdir -p "$PHASE_DIR/logs"
: > "$PHASE_DIR/summary.tsv"
: > "$PHASE_DIR/identities.tsv"
: > "$PHASE_DIR/normalized-failures.txt"
RUNNER_ERRORS=0
KNOWN_DEBT='src/lib/interface-workbench/__tests__/persistence.test.ts:38-39::runtime models remain outside this foundation'

EXPECTED_INTERFACE_TESTS=$(printf '%s\n' \
  src/lib/interface-workbench/__tests__/admin.test.ts \
  src/lib/interface-workbench/__tests__/bounds.test.ts \
  src/lib/interface-workbench/__tests__/compiler.test.ts \
  src/lib/interface-workbench/__tests__/diff.test.ts \
  src/lib/interface-workbench/__tests__/persistence.test.ts \
  src/lib/interface-workbench/__tests__/policy.test.ts \
  src/lib/interface-workbench/__tests__/publication.test.ts \
  src/lib/interface-workbench/__tests__/runtime-engine.test.ts \
  src/lib/interface-workbench/__tests__/runtime-governance-route-action.test.ts \
  src/lib/interface-workbench/__tests__/runtime-permissions.test.ts \
  src/lib/interface-workbench/__tests__/runtime-persistence.test.ts \
  src/lib/interface-workbench/__tests__/runtime-service.test.ts \
  src/lib/interface-workbench/ai-proposal-action.test.ts \
  src/lib/interface-workbench/ai-proposal.test.ts \
  src/lib/interface-workbench/editor.test.ts)

ACTUAL_INTERFACE_TESTS=$(rg --files src/lib/interface-workbench | LC_ALL=C sort | rg '\.test\.ts$' || true)
if ! test "$ACTUAL_INTERFACE_TESTS" = "$EXPECTED_INTERFACE_TESTS"; then RUNNER_ERRORS=1; fi
if ! test "$(printf '%s\n' "$ACTUAL_INTERFACE_TESTS" | awk 'NF { n++ } END { print n + 0 }')" -eq 15; then RUNNER_ERRORS=1; fi

ACTUAL_DATA_PRETRAINING_TESTS=$(rg --files src/app/app/interfaces/data-pretraining | LC_ALL=C sort | rg '\.test\.ts$' || true)
if ! test -z "$ACTUAL_DATA_PRETRAINING_TESTS"; then RUNNER_ERRORS=1; fi

run_and_collect_test() {
  test_file="$1"
  log_name=$(printf '%s' "$test_file" | tr '/[]' '____')
  log_file="$PHASE_DIR/logs/$log_name.junit.xml"
  stderr_file="$PHASE_DIR/logs/$log_name.stderr.log"
  ./node_modules/.bin/tsx --test --test-reporter=junit "$test_file" > "$log_file" 2> "$stderr_file"
  exit_status=$?
  test_count=$(xmllint --xpath 'string(count(//testcase))' "$log_file" 2>/dev/null || true)
  failure_count=$(xmllint --xpath 'string(count(//testcase[failure]))' "$log_file" 2>/dev/null || true)
  case "$test_count" in ''|*[!0-9]*) test_count=0; RUNNER_ERRORS=1 ;; esac
  case "$failure_count" in ''|*[!0-9]*) failure_count=0; RUNNER_ERRORS=1 ;; esac
  if test "$test_count" -le 0; then RUNNER_ERRORS=1; fi
  if test "$exit_status" -ne 0 && test "$failure_count" -eq 0; then RUNNER_ERRORS=1; fi
  if test "$exit_status" -eq 0 && test "$failure_count" -ne 0; then RUNNER_ERRORS=1; fi
  printf '%s\t%s\t%s\t%s\n' "$test_file" "$test_count" "$failure_count" "$exit_status" >> "$PHASE_DIR/summary.tsv"
  case_index=1
  while test "$case_index" -le "$test_count"; do
    case_name=$(xmllint --xpath "string((//testcase)[$case_index]/@name)" "$log_file" 2>/dev/null || true)
    case_name=$(printf '%s' "$case_name" | tr '\t\n' '  ')
    case_failures=$(xmllint --xpath "string(count((//testcase)[$case_index]/failure))" "$log_file" 2>/dev/null || printf 0)
    case "$case_failures" in ''|*[!0-9]*) case_failures=0; RUNNER_ERRORS=1 ;; esac
    if test -z "$case_name"; then RUNNER_ERRORS=1; fi
    case_status=PASS
    if test "$case_failures" -gt 0; then
      case_status=FAIL
      case "$test_file::$case_name" in
        'src/lib/interface-workbench/__tests__/persistence.test.ts::'*'runtime models remain outside this foundation')
          printf '%s\n' "$KNOWN_DEBT" >> "$PHASE_DIR/normalized-failures.txt" ;;
        *)
          printf '%s::%s\n' "$test_file" "$case_name" >> "$PHASE_DIR/normalized-failures.txt" ;;
      esac
    fi
    printf '%s\t%s\t%s\n' "$test_file" "$case_status" "$case_name" >> "$PHASE_DIR/identities.tsv"
    case_index=$((case_index + 1))
  done
}

run_and_collect_bracket_test() {
  test_file='src/app/app/meetings/[id]/tactical-outcome-actions.test.ts'
  tap_file="$PHASE_DIR/logs/tactical-outcome-actions.bracket.tap"
  stderr_file="$PHASE_DIR/logs/tactical-outcome-actions.bracket.stderr.log"
  ./node_modules/.bin/tsx 'src/app/app/meetings/[id]/tactical-outcome-actions.test.ts' > "$tap_file" 2> "$stderr_file"
  exit_status=$?
  test_count=$(awk '/^# tests / { n=$3 } END { print n + 0 }' "$tap_file")
  failure_count=$(awk '/^# fail / { n=$3 } END { print n + 0 }' "$tap_file")
  if test "$test_count" -le 0; then RUNNER_ERRORS=1; fi
  if test "$exit_status" -ne 0 && test "$failure_count" -eq 0; then RUNNER_ERRORS=1; fi
  if test "$exit_status" -eq 0 && test "$failure_count" -ne 0; then RUNNER_ERRORS=1; fi
  printf '%s\t%s\t%s\t%s\n' "$test_file" "$test_count" "$failure_count" "$exit_status" >> "$PHASE_DIR/summary.tsv"
  awk -v file="$test_file" '
    /^[[:space:]]*(not )?ok [0-9]+ - / {
      line=$0
      status=(line ~ /^[[:space:]]*not ok / ? "FAIL" : "PASS")
      sub(/^[[:space:]]*(not )?ok [0-9]+ - /, "", line)
      print file "\t" status "\t" line
    }
  ' "$tap_file" >> "$PHASE_DIR/identities.tsv"
  awk -v file="$test_file" '
    /^[[:space:]]*not ok [0-9]+ - / {
      line=$0
      sub(/^[[:space:]]*not ok [0-9]+ - /, "", line)
      print file "::" line
    }
  ' "$tap_file" >> "$PHASE_DIR/normalized-failures.txt"
}

while IFS= read -r test_file; do
  run_and_collect_test "$test_file"
done <<EOF
$EXPECTED_INTERFACE_TESTS
src/lib/__tests__/domain-operations.test.ts
src/lib/__tests__/tactical-outcome-proposal.test.ts
EOF

run_and_collect_bracket_test

if test "$GD1_GATE_PHASE" = final; then
  run_and_collect_test src/lib/__tests__/governance-decision.test.ts
  run_and_collect_test src/lib/interface-workbench/__tests__/governance-decision-persistence.test.ts
  run_and_collect_test src/lib/interface-workbench/__tests__/governance-decision-action.test.ts
fi

LC_ALL=C sort -o "$PHASE_DIR/identities.tsv" "$PHASE_DIR/identities.tsv"
LC_ALL=C sort -o "$PHASE_DIR/normalized-failures.txt" "$PHASE_DIR/normalized-failures.txt"
printf '%s\n' "$KNOWN_DEBT" > "$PHASE_DIR/expected-known-debt.txt"
if ! diff -u "$PHASE_DIR/expected-known-debt.txt" "$PHASE_DIR/normalized-failures.txt"; then RUNNER_ERRORS=1; fi

if test "$GD1_GATE_PHASE" = baseline; then
  cp "$PHASE_DIR/summary.tsv" "$GD1_TEST_EVIDENCE_ROOT/baseline.summary.tsv"
  cp "$PHASE_DIR/identities.tsv" "$GD1_TEST_EVIDENCE_ROOT/baseline.identities.tsv"
  cp "$PHASE_DIR/normalized-failures.txt" "$GD1_TEST_EVIDENCE_ROOT/baseline.normalized-failures.txt"
else
  if ! diff -u "$GD1_TEST_EVIDENCE_ROOT/baseline.normalized-failures.txt" "$PHASE_DIR/normalized-failures.txt"; then RUNNER_ERRORS=1; fi
  awk -F '\t' '
    NR == FNR { baseline_file[$1]=1; next }
    $1 in baseline_file { print }
  ' "$GD1_TEST_EVIDENCE_ROOT/baseline.summary.tsv" "$PHASE_DIR/identities.tsv" \
    | LC_ALL=C sort > "$PHASE_DIR/baseline-file-identities.tsv"
  if ! cmp -s "$GD1_TEST_EVIDENCE_ROOT/baseline.identities.tsv" "$PHASE_DIR/baseline-file-identities.tsv"; then
    diff -u "$GD1_TEST_EVIDENCE_ROOT/baseline.identities.tsv" "$PHASE_DIR/baseline-file-identities.tsv" || true
    RUNNER_ERRORS=1
  fi
  if ! awk -F '\t' '
    NR == FNR {
      if ($1 in baseline) bad=1
      baseline[$1]=$2
      next
    }
    $1 in baseline {
      seen[$1]++
      if ($2 != baseline[$1]) bad=1
    }
    END {
      for (file in baseline) if (seen[file] != 1) bad=1
      exit bad
    }
  ' "$GD1_TEST_EVIDENCE_ROOT/baseline.summary.tsv" "$PHASE_DIR/summary.tsv"; then RUNNER_ERRORS=1; fi
  if ! awk -F '\t' '
    BEGIN {
      required["src/lib/__tests__/governance-decision.test.ts"]=1
      required["src/lib/interface-workbench/__tests__/governance-decision-persistence.test.ts"]=1
      required["src/lib/interface-workbench/__tests__/governance-decision-action.test.ts"]=1
    }
    $1 in required {
      seen[$1]++
      if ($2 <= 0 || $3 != 0 || $4 != 0) bad=1
    }
    END {
      for (file in required) if (seen[file] != 1) bad=1
      exit bad
    }
  ' "$PHASE_DIR/summary.tsv"; then RUNNER_ERRORS=1; fi
fi

test "$RUNNER_ERRORS" -eq 0
```

Expected discovery is exactly 15 current `src/lib/interface-workbench` test files and zero dedicated `src/app/app/interfaces/data-pretraining/*.test.ts` files. Discovery mismatch is recorded as a runner error, but assertions occur only after every selected file has run. Non-bracket files use `tsx --test --test-reporter=junit`; the bracket path uses the proven direct `./node_modules/.bin/tsx 'src/app/app/meetings/[id]/tactical-outcome-actions.test.ts'` form and retains TAP plus stderr logs. JUnit/TAP logs and sorted `identities.tsv` retain every PASS/FAIL identity; `summary.tsv` records discovered/failing counts and exit status; every file requires `test_count > 0`. Baseline phase runs only files that already exist; final phase reruns that identical regression set and adds the three GD1 suites.

Baseline must end with exactly one normalized failure identity: `src/lib/interface-workbench/__tests__/persistence.test.ts:38-39::runtime models remain outside this foundation`. That known foundation-era runtime-model-prohibition debt remains a recorded FAIL and is never counted as a pass, but it does not abort remaining files. Any other baseline failure rejects the baseline. At final gate, `cmp -s` plus diagnostic `diff -u` requires the normalized, sorted PASS/FAIL identities for every baseline-selected file to equal `baseline.identities.tsv` byte-for-byte, and the summary comparison requires every baseline file exactly once with exactly the same test count. This rejects a renamed, added, or removed baseline test, any count difference, any new failure, failure-identity/status drift, or a lost file. The three new GD1 test files are deliberately outside baseline identity equality; each has its own exactly-once, `test_count > 0`, zero-failure, exit-0 gate. Final normalized failures must still be exactly the unchanged known debt and no other failure. Because the current repository has no dedicated Data -> Pretraining test file, these static suites prove workbench/runtime/domain/tactical regression only; they do not prove the pilot flow. The separate real Data -> Pretraining browser regression below remains mandatory.

**Real DB probes**

On the Slice 1 disposable database after reapply, run the fixture and direct service/SQL probes. Snapshot before/after counts and row images for operation/slot, process/revision/event, role, decision, change, result artifact, proposal, and tension.

Required denial probes: nonparticipant; former participant; admin/coach/lead/interface-support/affected-holder title only; wrong tenant/meeting/type; forged source/proposal/route artifact or command/node/visit/revision metadata; stale revision/state; changed payload/same key; fresh key/existing slot; non-proposer revision; unresolved clarification/objection; post-non-adoption revision adoption; `HALTED`/`ARCHIVED`/cross-tenant circle; unsupported payload; and all three legacy bypasses. Every denial includes unchanged operation count and proves an unused fresh key/slot remains available.

Required success/concurrency probes: initialization pointer commit; all six states; invalid and valid objection; proposer-left-meeting revision plus result denial; post-non-adoption revision; `NORMAL` and `WARNING` role creation; exact historical replay; replay denial after participant removal; two participant adoption race creates one outcome; failure at every adoption step; mandatory failure audit; failure-audit failure -> expired same-key reclaim; same-key retry attempt 2; database revision/operation/process mutation rejection.

**Isolated browser runtime**

```bash
export GD1_PORT=3120
export GD1_SESSION="loopos_gd1_$GD1_DB"
if lsof -nP -iTCP:"$GD1_PORT" -sTCP:LISTEN; then echo "GD1_PORT is occupied; choose another isolated port"; exit 1; fi
DATABASE_URL="$GD1_DATABASE_URL" ./node_modules/.bin/tsx scripts/g3-i2c-gd1-governance-decision-fixture.ts setup
tmux new-session -d -s "$GD1_SESSION" "cd /Users/heyiqing/LLM/loopos && DATABASE_URL='$GD1_DATABASE_URL' ./node_modules/.bin/next dev --port '$GD1_PORT'"
curl --fail --retry 30 --retry-delay 1 "http://127.0.0.1:$GD1_PORT/app"
```

Browser evidence is separate from static/DB evidence and must cover:

1. proposer creates revision 1;
2. participant clarification -> proposer revision 2;
3. invalid objection returns same revision to `READY`;
4. valid objection blocks adoption, proposer leaves meeting, authors/replays amendment, and cannot record/replay a result;
5. non-adoption keeps tension open/zero role, then same-proposal next revision returns `READY` with history visible;
6. another participant adopts and creates one unassigned role;
7. proposer self-recording on a separate candidate;
8. nonparticipant/title-only/former-participant no controls plus direct denial and unchanged ledger;
9. failure plus refresh preserves same key, fresh key denied, same-key retry succeeds; separate failure-audit persistence failure and expired reclaim visible;
10. terminal/historical replay succeeds only while exact current authority remains;
11. meeting/tension/role/governance/run/artifact links survive refresh;
12. wrong-tenant/wrong-meeting URLs/actions deny without leakage;
13. `NORMAL`/`WARNING` allowed and `HALTED`/`ARCHIVED` denied;
14. desktop and 390×844 show complete content/actions with no horizontal overflow, clipped controls, nested-scroll trap, development overlay, console error, failed request, or GD1 warning.

Then perform a real Data -> Pretraining browser regression: submit validation, record failed smoke, create failure tension, process the exact tactical card, mark pilot governance candidate, confirm weekly visibility, verify Project/Action/defer and trace behavior, and verify generic GD1 candidates do not enter the pilot weekly rollup. Static checks are not substitutes.

**Rollback point**

Before product acceptance, stop the isolated service and run reviewed reverse SQL only in the disposable DB. Source rollback must then run:

```bash
rollback_all_slices
```

Every slice baseline manifest/hash/mode comparison must match before proceeding to the next reversal; whole-path restore/reset/delete is prohibited. After any real adopted result, never delete/auto-archive the role; disable new GD1 actions and preserve read/audit history. Structural reversal requires a future tension and governance proposal.

**Completion evidence and dependency**

Run `close_slice slice-4` after all Slice 4 checks, then `release_workspace_lock slice-4`. Retain focused/static/build logs, migration/probe transcript, fixture IDs, browser screenshots/video at desktop and 390px, console/network capture, Data -> Pretraining regression evidence, every slice's baseline/own-delta checksums, and retained accepted meeting URL. There is no later implementation slice; closure proceeds through the quality gates below.

## 8. Closure quality gates

1. One independent `/review` reads the exact diff and evidence, prioritizing P0/P1/P2 correctness, tenant isolation, authority-before-claim/replay, six-state legality, immutable history, concurrency, retry/failure audit, atomicity, provenance, legacy bypass, and UI wording. Review is read-only.
2. At most one concentrated correction pass edits only reviewed GD1-owned files and reruns every affected focused/DB/browser/regression gate.
3. The same reviewer rechecks every original finding and returns no remaining P0/P1/P2. Do not widen into a second correction round.
4. A separate roadmap/current-state auditor compares implementation, tests, DB/browser proof, review closure, exact scope, and the still-inactive I2C-3/second-interface slices. Audit is read-only; roadmap/dashboard updates are coordinator work only after PASS.
5. Product owner opens the retained meeting page and explicitly accepts the visible flow.
6. Only after acceptance, clean the isolated environment:

```bash
tmux kill-session -t "$GD1_SESSION"
DATABASE_URL="$GD1_DATABASE_URL" ./node_modules/.bin/tsx scripts/g3-i2c-gd1-governance-decision-fixture.ts cleanup
dropdb "$GD1_DB"
! lsof -nP -iTCP:"$GD1_PORT" -sTCP:LISTEN
! psql -lqt | cut -d '|' -f 1 | tr -d ' ' | grep -Fx "$GD1_DB"
```

Do not kill an unknown port owner. If the chosen port becomes occupied by another process, inspect and choose a different isolated port.

## 9. Definition of Done evidence checklist

- [ ] Exact routed generic candidate uses the approved six states and one proposal identity with complete immutable increasing revisions.
- [ ] Process current revision is initialized process -> revision 1 -> pointer in one transaction; deferred PostgreSQL validation rejects null/mismatched commits.
- [ ] Revision and event history is append-only; operation identity/binding/key/history is immutable; process provenance cannot change.
- [ ] Authorization occurs inside claim/replay before every insert/reservation/reclaim; all denials include unchanged ledger and global zero writes.
- [ ] Original proposer may author after leaving the meeting but cannot record/replay results; actual current participants may record results; title-only identities cannot.
- [ ] Exact historical replay reauthorizes current operation-specific authority and returns immutable original results with zero writes.
- [ ] Clarification, pending/valid objection, invalid objection, non-adoption, denial, and technical failure never create structure/resolution writes.
- [ ] Non-adoption is revision-terminal; proposer revision + 1 on the same open-tension proposal returns `READY` without new proposal/route/outcome/structure.
- [ ] Only canonical `ROLE_CREATED` executes; target is same-tenant `NORMAL`/`WARNING`; `HALTED`/`ARCHIVED` denied; role is `HOME`, `ACTIVE`, and unassigned.
- [ ] Adoption is serializable and atomically creates one role, decision, change log, process/proposal result, role artifact, ordered events, and source-tension resolution.
- [ ] Failure injection leaves zero partial effects; mandatory audit, same-key retry, expired same-key reclaim, fresh-key denial, and attempt history pass.
- [ ] Concurrent participants produce exactly one adopted outcome and one role.
- [ ] Legacy create/adopt/object paths preserve valid legacy behavior and cannot touch generic/GD1 candidates.
- [ ] Run page verifies the role artifact; governance page separates meeting authority, proposer, recorder, revision, role, change, run, and artifact.
- [ ] Focused tests, Prisma validate/generate, TypeScript, scoped ESLint, build, and diff checks pass with exact counts.
- [ ] Disposable DB apply/rollback/absence/reapply, catalog checks, success cardinality, and global zero-write probes pass.
- [ ] Browser matrix passes for proposer/current participant/nonparticipant/former participant, clarification, both objection results, non-adoption, adoption, failure/retry/replay, refresh, terminal links, desktop, and 390px.
- [ ] Real Data -> Pretraining browser regression passes; generic GD1 stays isolated from pilot weekly rollup.
- [ ] Independent review closes no P0/P1/P2 after at most one correction; independent audit passes.
- [ ] Product owner explicitly accepts the retained visible page.
- [ ] Isolated service, port, fixture state, and disposable database cleanup are verified.
- [ ] I2C-3, second-interface migration, roadmap closure, and implementation status remain untouched until separately authorized.

## 10. Explicit non-implementation statement

This document is a plan only. No GD1 schema, migration, generated client, domain service, Server Action, UI, fixture, database row, runtime, roadmap state, or dashboard state was implemented or activated while producing it. Current implementation remains inactive.
