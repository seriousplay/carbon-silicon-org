import { AsyncLocalStorage } from "node:async_hooks";

const collaborationActionTestDependencies = new AsyncLocalStorage<unknown>();

export function currentCollaborationActionDependencies<T>(production: T): T {
  return (collaborationActionTestDependencies.getStore() as T | undefined) ?? production;
}

export function withCollaborationActionTestDependencies<TDependencies, TResult>(
  dependencies: TDependencies,
  work: () => Promise<TResult>,
): Promise<TResult> {
  return collaborationActionTestDependencies.run(dependencies, work);
}
