"use server";

import { denyDirectStructureMutation } from "@/lib/bootstrap-authority";

export type CircleEditState = { error?: string } | undefined;

export async function editCircleAction(
  _circleId: string,
  _prev: CircleEditState,
  _formData: FormData
): Promise<CircleEditState> {
  void _circleId;
  void _prev;
  void _formData;
  return denyDirectStructureMutation();
}
