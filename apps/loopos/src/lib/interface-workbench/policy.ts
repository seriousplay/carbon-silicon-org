export type WorkbenchOperation = "edit" | "validate" | "compare" | "publish";

export type WorkbenchActor = {
  membershipRole: "ORG_ADMIN" | "ORG_MEMBER" | null;
};

export function canAdministerWorkbench(
  actor: WorkbenchActor,
  operation: WorkbenchOperation,
): boolean {
  switch (operation) {
    case "edit":
    case "validate":
    case "compare":
    case "publish":
      return actor.membershipRole === "ORG_ADMIN";
  }
}
