import { AsyncLocalStorage } from "node:async_hooks";

const tacticalOutcomeActionTestDependencies = new AsyncLocalStorage<unknown>();

export function currentTacticalOutcomeActionDependencies<T>(production: T): T {
  return (tacticalOutcomeActionTestDependencies.getStore() as T | undefined) ?? production;
}

export function withTacticalOutcomeActionTestDependencies<TDependencies, TResult>(
  dependencies: TDependencies,
  work: () => Promise<TResult>,
): Promise<TResult> {
  return tacticalOutcomeActionTestDependencies.run(dependencies, work);
}
