import type { CandidateFlags, CandidateRecord } from "./types";

export function computeCandidateRank(candidate: CandidateRecord) {
  return Object.values(candidate.flags).filter(Boolean).length;
}

export function computeWeightedScore(flags: CandidateFlags) {
  const score = {
    pain: flags.pain ? 5 : 1,
    data: flags.data ? 5 : 1,
    copy: flags.owner ? 5 : 1,
    risk: flags.shortLoop ? 5 : 1,
  };
  return {
    ...score,
    total: score.pain * 0.4 + score.data * 0.3 + score.copy * 0.2 + score.risk * 0.1,
  };
}

