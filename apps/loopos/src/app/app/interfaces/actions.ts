"use server";

import { denyDirectStructureMutation } from "@/lib/bootstrap-authority";

export type InterfaceFormState = { error?: string } | undefined;

export async function createInterfaceAction(
  _prev: InterfaceFormState,
  _formData: FormData
): Promise<InterfaceFormState> {
  void _prev;
  void _formData;
  return denyDirectStructureMutation();
}
