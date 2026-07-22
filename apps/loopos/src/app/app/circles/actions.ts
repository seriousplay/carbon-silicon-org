"use server";

/** 退役的直接回路写入口：保留稳定拒绝供旧客户端调用。 */
import { denyDirectStructureMutation } from "@/lib/bootstrap-authority";

export type CircleFormState = { error?: string } | undefined;

export async function createCircleAction(
  _prev: CircleFormState,
  _formData: FormData
): Promise<CircleFormState> {
  void _prev;
  void _formData;
  return denyDirectStructureMutation();
}
