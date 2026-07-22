import "server-only";

import { resolveActorContext } from "./actor-context";
import {
  evaluateReadAccess,
  type ReadAccessBasis,
  type ReadAccessDenialReason,
  type ReadPolicyResource,
} from "./read-policy-core";

export class ReadAccessDeniedError extends Error {
  constructor(public readonly reason: ReadAccessDenialReason) {
    super(`Read access denied: ${reason}`);
    this.name = "ReadAccessDeniedError";
  }
}

export type EnforcedReadAccess = {
  organizationId: string;
  userId: string;
  personId: string;
  basis: ReadAccessBasis;
};

export async function enforceReadAccess(
  resource: ReadPolicyResource,
): Promise<EnforcedReadAccess> {
  const actor = await resolveActorContext();
  const decision = evaluateReadAccess({ actor, resource });
  if (!decision.allowed) {
    throw new ReadAccessDeniedError(decision.reason);
  }

  return {
    organizationId: actor.organizationId,
    userId: actor.userId,
    personId: actor.personId,
    basis: decision.basis,
  };
}

export type {
  ReadAccessBasis,
  ReadAccessDenialReason,
  ReadDataZone,
  ReadObjectType,
  ReadPolicyResource,
} from "./read-policy-core";
