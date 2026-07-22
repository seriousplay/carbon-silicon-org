"use server";

import { denyDirectStructureMutation } from "@/lib/bootstrap-authority";

export type CharterFormState = { error?: string; ok?: boolean } | undefined;

export async function createCharterAction(
  _prev: CharterFormState,
  _formData: FormData
): Promise<CharterFormState> {
  void _prev;
  void _formData;
  return denyDirectStructureMutation();
}

export async function ratifyCharterAction(_charterId: string): Promise<CharterFormState> {
  void _charterId;
  return denyDirectStructureMutation();
}
