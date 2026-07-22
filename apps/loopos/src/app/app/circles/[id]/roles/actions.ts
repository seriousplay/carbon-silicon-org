"use server";

import { denyDirectStructureMutation } from "@/lib/bootstrap-authority";

export type RoleFormState = { error?: string } | undefined;

export async function createRoleAction(
  _prev: RoleFormState,
  _formData: FormData
): Promise<RoleFormState> {
  void _prev;
  void _formData;
  return denyDirectStructureMutation();
}
