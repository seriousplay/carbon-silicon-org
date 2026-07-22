# V5-M6-0 Independent Security Reclosure

Date: 2026-07-17

Conclusion: PASS

No P0/P1/P2 findings.

## Scope

- Production Organization Brain Reader role and ACL boundary.
- BioCoach data isolation from both LoopOS application and Brain credentials.
- Mutation-denial verifier correctness.
- Cross-tenant authenticated Brain-read evidence.

## Reclosure

The first independent review found two P1 and two P2 issues:

1. readiness checked only login-role attributes and not the reader role or full
   effective ACL surface;
2. mutation denial accepted any error and checked only one canonical table;
3. the view probe did not prove a denied actor context;
4. the readiness result lacked a script hash.

The same reviewer rechecked only those four findings after correction and
closed all four:

- login and reader attributes are both checked;
- the exact `20/20` security-barrier view allowlist and all effective schema,
  relation, sequence, function, direct/default ACL, PUBLIC function, and
  function-default surfaces are checked;
- a forged actor and organization context must return zero rows;
- mutation runs a safe `WHERE false` update in a rollback transaction and only
  accepts SQLSTATE `42501`;
- the production browser test uses two real organizations in separate browser
  contexts, proves own fact presence and other-organization absence in both
  directions, and records zero HTTP/browser errors and zero cleanup residue;
- all production verifier hashes are recorded and match the reviewed files.

## Evidence Classification

- Source review: performed independently against the current working files.
- Production execution: independently reviewed from
  `docs/evidence/2026-07-17-v5-m6-0-brain-reader-readiness.md`; the reviewer did
  not claim to rerun production.
- Reviewer made no file changes.

## Blockers

None for the reviewed security boundary. Final M5-B roadmap/current-state
acceptance audit remains separate.
