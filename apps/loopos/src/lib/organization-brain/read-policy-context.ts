import type { ActorContext } from "../authorization/actor-context-resolver";

export type BrainReadPolicyContext = Readonly<{
  organizationId: string;
  userId: string;
  personId: string;
}>;

export function toBrainReadPolicyContext(
  actor: ActorContext,
): BrainReadPolicyContext {
  return Object.freeze({
    organizationId: actor.organizationId,
    userId: actor.userId,
    personId: actor.personId,
  });
}
