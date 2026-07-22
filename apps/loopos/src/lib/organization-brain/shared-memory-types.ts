import type {
  MemoryCandidateActor,
  MemoryCandidateAuthorityRoute,
  MemoryCandidateAuthorityRouteKind,
  MemoryCandidateSourceRef,
  MemoryCandidateSupersessionRef,
} from "./memory-candidate-types";

export type SharedMemoryConfidence = "SOURCE_CONFIRMED";

export type SharedMemoryEntry = Readonly<{
  schemaVersion: 1;
  candidateId: string;
  organizationId: string;
  claim: string;
  rationale: string;
  authorityRoute: MemoryCandidateAuthorityRoute;
  sourceRefs: readonly MemoryCandidateSourceRef[];
  confirmedBy: MemoryCandidateActor;
  validFrom: string;
  validUntil: string | null;
  supersededBy: MemoryCandidateSupersessionRef | null;
  confidence: SharedMemoryConfidence;
  applicationUrl: string;
  ranking: SharedMemoryRankingInput;
}>;

export type SharedMemoryRankingInput = Readonly<{
  routeRank: number;
  sourceCount: number;
  textMatchCount: number;
  validFromTime: number;
  candidateId: string;
}>;

export type SharedMemoryQuery = Readonly<{
  text?: string | null;
  authorityRouteKind?: MemoryCandidateAuthorityRouteKind | null;
  limit?: number | null;
}>;
