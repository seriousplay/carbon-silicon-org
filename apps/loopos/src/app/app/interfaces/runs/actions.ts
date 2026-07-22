"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, getCurrentPerson } from "@/lib/session";
import { canStartInterfaceWorkflow } from "@/lib/interface-workbench/runtime-permissions";
import { createPrismaRuntimeDependencies, startWorkflowRun } from "@/lib/interface-workbench/runtime-service";

type SourceRole = { id: string };

export async function startRunAction(workbenchId: string, formData: FormData): Promise<void> {
  let destination = "/app/interfaces/runs?message=start-failed";
  try {
    const session = await requireSession();
    const person = await getCurrentPerson();
    if (!person) return redirect("/app/interfaces/runs?message=denied");
    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: person.organizationId } },
      select: { role: true },
    });
    const [actorRoles, workbench] = await Promise.all([
      prisma.roleDef.findMany({
        where: { organizationId: person.organizationId, assignees: { some: { id: person.id } } },
        select: { id: true },
      }),
      prisma.interfaceWorkbench.findFirst({
        where: {
          id: workbenchId,
          organizationId: person.organizationId,
          activeVersionId: { not: null },
          interface: { status: { not: "ARCHIVED" } },
        },
        select: {
          id: true,
          activeVersion: { select: { sourceSnapshot: true } },
          interface: {
            select: {
              organizationId: true,
              ownerId: true,
              fromCircle: { select: { leadPersonId: true } },
              toCircle: { select: { leadPersonId: true } },
              supportPeople: { select: { id: true } },
              supportRoles: { where: { status: "ACTIVE" }, select: { id: true } },
            },
          },
        },
      }),
    ]);
    if (!membership || !workbench?.activeVersion) {
      destination = "/app/interfaces/runs?message=denied";
    } else {
      const actor = {
        organizationId: person.organizationId,
        personId: person.id,
        membershipRole: membership.role,
        assignedRoleDefIds: actorRoles.map((role) => role.id),
      };
      const interfaceContext = {
        organizationId: workbench.interface.organizationId,
        ownerId: workbench.interface.ownerId,
        fromCircleLeadPersonId: workbench.interface.fromCircle.leadPersonId,
        toCircleLeadPersonId: workbench.interface.toCircle.leadPersonId,
        supportPersonIds: workbench.interface.supportPeople.map((item) => item.id),
        supportRoleDefIds: workbench.interface.supportRoles.map((item) => item.id),
      };
      const roles = readSourceRoles(workbench.activeVersion.sourceSnapshot);
      if (!roles || !canStartInterfaceWorkflow(actor, interfaceContext)) {
        destination = "/app/interfaces/runs?message=denied";
      } else {
        const allowedPersonIds = new Set([
          person.id,
          workbench.interface.ownerId,
          ...workbench.interface.supportPeople.map((item) => item.id),
        ]);
        const allowedRoleIds = new Set(workbench.interface.supportRoles.map((item) => item.id));
        const bindings = roles.map((role) => {
          const value = String(formData.get(`binding:${role.id}`) ?? "");
          const parsed = parseBinding(value);
          if (!parsed) return null;
          if (parsed.kind === "person" && allowedPersonIds.has(parsed.id)) {
            return { roleId: role.id, personId: parsed.id } as const;
          }
          if (parsed.kind === "role" && allowedRoleIds.has(parsed.id)) {
            return { roleId: role.id, roleDefId: parsed.id } as const;
          }
          return null;
        });
        if (bindings.some((binding) => binding === null)) {
          destination = "/app/interfaces/runs?message=invalid-binding";
        } else {
          const result = await startWorkflowRun({
            organizationId: person.organizationId,
            workbenchId: workbench.id,
            starterId: person.id,
            bindings: bindings.filter((binding) => binding !== null),
          }, createPrismaRuntimeDependencies(prisma));
          destination = result.ok
            ? `/app/interfaces/runs/${result.runId}`
            : `/app/interfaces/runs?message=${result.error === "NO_ACTIVE_VERSION" ? "version-changed" : result.error === "INVALID_BINDINGS" ? "invalid-binding" : "start-failed"}`;
        }
      }
    }
  } catch {
    destination = "/app/interfaces/runs?message=start-failed";
  }
  redirect(destination);
}

function parseBinding(value: string): { kind: "person" | "role"; id: string } | null {
  const separator = value.indexOf(":");
  if (separator <= 0 || separator !== value.lastIndexOf(":")) return null;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  return id && (kind === "person" || kind === "role") ? { kind, id } : null;
}

function readSourceRoles(value: unknown): SourceRole[] | null {
  if (!isRecord(value) || !Array.isArray(value.roles)) return null;
  const ids = new Set<string>();
  const roles: SourceRole[] = [];
  for (const role of value.roles) {
    if (!isRecord(role) || typeof role.id !== "string" || !role.id || ids.has(role.id)) return null;
    ids.add(role.id);
    roles.push({ id: role.id });
  }
  return roles;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
