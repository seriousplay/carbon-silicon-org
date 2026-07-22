import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { toBeActorAssignmentSchema, toBeControlProfileSchema, toBeTimeEstimateSchema } from "@/lib/plan-schema";
import { updateLoopPlanCellRuntime } from "@/lib/sessions";

const runtimePatchSchema = z.object({
  cellId: z.string().min(1),
  actorAssignments: z.array(toBeActorAssignmentSchema).min(3).optional(),
  controlProfile: toBeControlProfileSchema.optional(),
  timeEstimate: toBeTimeEstimateSchema.optional(),
}).superRefine((patch, context) => {
  if (!patch.actorAssignments && !patch.controlProfile && !patch.timeEstimate) {
    context.addIssue({ code: "custom", message: "No runtime fields provided" });
  }
  if (patch.actorAssignments) {
    const types = new Set(patch.actorAssignments.map((item) => item.type));
    (["human", "agent", "system"] as const).forEach((type) => {
      if (!types.has(type)) {
        context.addIssue({ code: "custom", path: ["actorAssignments"], message: `Missing ${type} actor` });
      }
    });
  }
});

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await context.params;
    const payload = runtimePatchSchema.parse(await request.json());
    const session = await updateLoopPlanCellRuntime(user, sessionId, payload);
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}
