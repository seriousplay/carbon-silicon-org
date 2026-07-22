export const DIRECT_STRUCTURE_MUTATION_DENIAL =
  "组织结构只能通过正式治理流程变更";

export const BOOTSTRAP_AUTHORITY_DENIAL =
  "组织初始化仅限无运转历史的全新组织，且只能执行一次";

export type BootstrapAuthoritySnapshot = {
  circleCount: number;
  rootCircleCount: number;
  roleCount: number;
  interfaceCount: number;
  charterCount: number;
  changeLogCount: number;
  meetingCount: number;
  decisionCount: number;
  governanceProposalCount: number;
  tacticalOutcomeProposalCount: number;
  projectCount: number;
  tensionCount: number;
};

export function canApplyBootstrapTemplate(
  snapshot: BootstrapAuthoritySnapshot
): boolean {
  return (
    snapshot.circleCount === 1 &&
    snapshot.rootCircleCount === 1 &&
    snapshot.roleCount === 0 &&
    snapshot.interfaceCount === 0 &&
    snapshot.charterCount === 0 &&
    snapshot.changeLogCount === 0 &&
    snapshot.meetingCount === 0 &&
    snapshot.decisionCount === 0 &&
    snapshot.governanceProposalCount === 0 &&
    snapshot.tacticalOutcomeProposalCount === 0 &&
    snapshot.projectCount === 0 &&
    snapshot.tensionCount === 0
  );
}

export function denyDirectStructureMutation(): { error: string } {
  return { error: DIRECT_STRUCTURE_MUTATION_DENIAL };
}
