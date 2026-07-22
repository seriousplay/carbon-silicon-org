"use server";

export type ProjectFormState = { error?: string } | undefined;

const RETIRED_PROJECT_CREATION_MESSAGE = "项目只能由战术会通过的项目提案创建";

export async function createProjectAction(
  _prev: ProjectFormState,
  _formData: FormData
): Promise<ProjectFormState> {
  void _prev;
  void _formData;
  return { error: RETIRED_PROJECT_CREATION_MESSAGE };
}
