import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createActorContextResolver } from "./actor-context-resolver";

const resolveUncachedActorContext = createActorContextResolver({
  getAuthenticatedUserId: async () => {
    const session = await getSession();
    return session?.user?.id ?? null;
  },
  loadUser: (userId) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        memberships: {
          select: {
            userId: true,
            organizationId: true,
            role: true,
          },
        },
        person: {
          select: {
            id: true,
            userId: true,
            organizationId: true,
            homeCircleId: true,
            organization: { select: { id: true } },
            homeCircle: {
              select: { id: true, organizationId: true },
            },
            roles: {
              select: { id: true, organizationId: true, status: true },
            },
            leadingCircles: {
              select: { id: true, organizationId: true, status: true },
            },
          },
        },
      },
    }),
});

export const resolveActorContext = cache(resolveUncachedActorContext);

export type { ActorContext } from "./actor-context-resolver";
