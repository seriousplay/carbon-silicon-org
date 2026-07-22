"use server";

/**
 * 智能体（硅基员工）管理
 *
 * AI 原生组织：智能体与人类在治理层面完全平等
 */
import { denyDirectStructureMutation } from "@/lib/bootstrap-authority";

export type AgentFormState = { error?: string } | undefined;

export async function createAgentAction(
  _prev: AgentFormState,
  _formData: FormData
): Promise<AgentFormState> {
  void _prev;
  void _formData;
  return denyDirectStructureMutation();
}
