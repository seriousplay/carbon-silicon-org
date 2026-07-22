import type {
  MemoryCandidate,
  MemoryCandidateActor,
  MemoryCandidateAuthorityRoute,
  MemoryCandidateAuthorityRouteKind,
  MemoryCandidateSourceRef,
} from "./memory-candidate-types";
import type {
  SharedMemoryEntry,
  SharedMemoryQuery,
  SharedMemoryRankingInput,
} from "./shared-memory-types";

export type SharedMemoryDerivationErrorCode =
  | "INVALID_CANDIDATE"
  | "INVALID_SOURCE"
  | "INVALID_QUERY";

export class SharedMemoryDerivationError extends Error {
  constructor(public readonly code: SharedMemoryDerivationErrorCode) {
    super(`Shared memory derivation failed: ${code}`);
    this.name = "SharedMemoryDerivationError";
  }
}

const MAX_ID_BYTES = 191;
const MAX_QUERY_BYTES = 400;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;
const ROUTE_RANK: Record<MemoryCandidateAuthorityRouteKind, number> = Object.freeze({
  TENSION: 0,
  MEETING_RECORD: 1,
  TACTICAL: 2,
  GOVERNANCE: 3,
  GOAL_STRATEGY: 4,
});
const SOURCE_TYPES = new Set([
  "goal",
  "target",
  "circle",
  "role",
  "accountability",
  "domain",
  "policy",
  "project",
  "action",
  "meeting",
  "decision",
  "tension",
  "unknown",
]);

type PlainRecord = Record<string, unknown>;

function fail(code: SharedMemoryDerivationErrorCode): never {
  throw new SharedMemoryDerivationError(code);
}

function bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function boundedString(value: unknown, maxBytes: number): string {
  if (typeof value !== "string") fail("INVALID_CANDIDATE");
  const trimmed = value.trim();
  if (trimmed.length === 0 || bytes(trimmed) > maxBytes) fail("INVALID_CANDIDATE");
  return trimmed;
}

function plainRecord(value: unknown): PlainRecord {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("INVALID_CANDIDATE");
  }
  return value as PlainRecord;
}

function requireIso(value: unknown): string {
  if (typeof value !== "string") fail("INVALID_CANDIDATE");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail("INVALID_CANDIDATE");
  return new Date(parsed).toISOString();
}

function optionalIso(value: unknown): string | null {
  if (value === null) return null;
  return requireIso(value);
}

function requireRoute(route: MemoryCandidateAuthorityRoute): MemoryCandidateAuthorityRoute {
  plainRecord(route);
  if (!Object.hasOwn(ROUTE_RANK, route.kind)) fail("INVALID_CANDIDATE");
  return Object.freeze({
    kind: route.kind,
    label: boundedString(route.label, 160),
    applicationUrl: requireApplicationUrl(route.applicationUrl),
  });
}

function requireActor(actor: MemoryCandidateActor | null): MemoryCandidateActor {
  plainRecord(actor);
  if (!actor || (actor.type !== "person" && actor.type !== "meeting" && actor.type !== "process")) {
    fail("INVALID_CANDIDATE");
  }
  return Object.freeze({
    type: actor.type,
    id: boundedString(actor.id, MAX_ID_BYTES),
    label: boundedString(actor.label, 160),
  });
}

function requireApplicationUrl(value: unknown): string {
  const url = boundedString(value, 512);
  if (!url.startsWith("/app/")) fail("INVALID_CANDIDATE");
  return url;
}

function requireSourceRef(ref: MemoryCandidateSourceRef): MemoryCandidateSourceRef {
  plainRecord(ref);
  if (!SOURCE_TYPES.has(ref.type)) fail("INVALID_CANDIDATE");
  return Object.freeze({
    type: ref.type,
    id: boundedString(ref.id, MAX_ID_BYTES),
    label: boundedString(ref.label, 200),
    applicationUrl: requireApplicationUrl(ref.applicationUrl),
    observedAt: requireIso(ref.observedAt),
  });
}

function sourceKey(ref: MemoryCandidateSourceRef): string {
  return `${ref.type}\0${ref.id}\0${ref.applicationUrl}`;
}

function filterAuthorizedSourceRefs(
  candidateRefs: readonly MemoryCandidateSourceRef[],
  authorizedRefs: readonly MemoryCandidateSourceRef[],
): readonly MemoryCandidateSourceRef[] {
  if (!Array.isArray(candidateRefs) || !Array.isArray(authorizedRefs)) fail("INVALID_CANDIDATE");
  const allowed = new Set(authorizedRefs.map((ref) => sourceKey(requireSourceRef(ref))));
  const filtered = candidateRefs
    .map(requireSourceRef)
    .filter((ref) => allowed.has(sourceKey(ref)));
  return Object.freeze(filtered);
}

function queryTokens(value: string | null | undefined): readonly string[] {
  if (value === null || value === undefined) return Object.freeze([]);
  if (typeof value !== "string" || bytes(value) > MAX_QUERY_BYTES) fail("INVALID_QUERY");
  const tokens = value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .slice(0, 12);
  return Object.freeze(tokens);
}

function textMatchCount(candidate: MemoryCandidate, sourceRefs: readonly MemoryCandidateSourceRef[], tokens: readonly string[]): number {
  if (tokens.length === 0) return 0;
  const haystack = [
    candidate.claim,
    candidate.rationale,
    candidate.authorityRoute.label,
    ...sourceRefs.map((ref) => ref.label),
  ].join(" ").toLowerCase();
  return tokens.filter((token) => haystack.includes(token)).length;
}

function entryTextMatchCount(entry: SharedMemoryEntry, tokens: readonly string[]): number {
  if (tokens.length === 0) return entry.ranking.textMatchCount;
  const haystack = [
    entry.claim,
    entry.rationale,
    entry.authorityRoute.label,
    ...entry.sourceRefs.map((ref) => ref.label),
  ].join(" ").toLowerCase();
  return tokens.filter((token) => haystack.includes(token)).length;
}

function rankingInput(
  candidate: MemoryCandidate,
  sourceRefs: readonly MemoryCandidateSourceRef[],
  tokens: readonly string[],
): SharedMemoryRankingInput {
  const route = requireRoute(candidate.authorityRoute);
  const validFrom = requireIso(candidate.validFrom);
  return Object.freeze({
    routeRank: ROUTE_RANK[route.kind],
    sourceCount: sourceRefs.length,
    textMatchCount: textMatchCount(candidate, sourceRefs, tokens),
    validFromTime: Date.parse(validFrom),
    candidateId: boundedString(candidate.id, MAX_ID_BYTES),
  });
}

function assertEligible(candidate: MemoryCandidate, now: Date): boolean {
  plainRecord(candidate);
  if (!Number.isFinite(now.getTime())) fail("INVALID_CANDIDATE");
  if (candidate.status !== "CONFIRMED") return false;
  if (candidate.supersededBy !== null) return false;
  if (!candidate.validFrom) return false;
  const validFrom = Date.parse(candidate.validFrom);
  if (!Number.isFinite(validFrom)) fail("INVALID_CANDIDATE");
  if (validFrom > now.getTime()) return false;
  if (candidate.validUntil !== null) {
    const validUntil = Date.parse(candidate.validUntil);
    if (!Number.isFinite(validUntil)) fail("INVALID_CANDIDATE");
    if (validUntil <= now.getTime()) return false;
  }
  if (!candidate.confirmedBy) fail("INVALID_CANDIDATE");
  return true;
}

export function deriveSharedMemoryEntry(
  candidate: MemoryCandidate,
  input: Readonly<{
    authorizedSourceRefs: readonly MemoryCandidateSourceRef[];
    now: Date;
    queryText?: string | null;
  }>,
): SharedMemoryEntry | null {
  if (!assertEligible(candidate, input.now)) return null;
  if (!Array.isArray(input.authorizedSourceRefs)) fail("INVALID_SOURCE");

  const route = requireRoute(candidate.authorityRoute);
  const sourceRefs = filterAuthorizedSourceRefs(candidate.sourceRefs, input.authorizedSourceRefs);
  if (sourceRefs.length === 0) return null;
  const tokens = queryTokens(input.queryText);

  return Object.freeze({
    schemaVersion: 1,
    candidateId: boundedString(candidate.id, MAX_ID_BYTES),
    organizationId: boundedString(candidate.organizationId, MAX_ID_BYTES),
    claim: boundedString(candidate.claim, 600),
    rationale: boundedString(candidate.rationale, 1200),
    authorityRoute: route,
    sourceRefs,
    confirmedBy: requireActor(candidate.confirmedBy),
    validFrom: requireIso(candidate.validFrom),
    validUntil: optionalIso(candidate.validUntil),
    supersededBy: null,
    confidence: "SOURCE_CONFIRMED",
    applicationUrl: route.applicationUrl,
    ranking: rankingInput(candidate, sourceRefs, tokens),
  });
}

function parseLimit(value: number | null | undefined): number {
  if (value === null || value === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) fail("INVALID_QUERY");
  return value;
}

export function rankSharedMemoryEntries(
  entries: readonly SharedMemoryEntry[],
  query: SharedMemoryQuery = {},
): readonly SharedMemoryEntry[] {
  const limit = parseLimit(query.limit);
  const tokens = queryTokens(query.text);
  const scored = entries.map((entry) => Object.freeze({
    entry,
    textMatchCount: entryTextMatchCount(entry, tokens),
  }));
  const filtered = scored.filter(({ entry, textMatchCount: currentTextMatchCount }) => {
    if (query.authorityRouteKind && entry.authorityRoute.kind !== query.authorityRouteKind) return false;
    return tokens.length === 0 || currentTextMatchCount > 0;
  });
  return Object.freeze([...filtered]
    .sort((left, right) =>
      right.textMatchCount - left.textMatchCount ||
      right.entry.ranking.routeRank - left.entry.ranking.routeRank ||
      right.entry.ranking.sourceCount - left.entry.ranking.sourceCount ||
      right.entry.ranking.validFromTime - left.entry.ranking.validFromTime ||
      left.entry.ranking.candidateId.localeCompare(right.entry.ranking.candidateId))
    .map(({ entry }) => entry)
    .slice(0, limit));
}
