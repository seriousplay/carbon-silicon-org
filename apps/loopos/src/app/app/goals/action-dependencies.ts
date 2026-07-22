import { AsyncLocalStorage } from "node:async_hooks";

const goalActionTestDependencies = new AsyncLocalStorage<unknown>();

export function currentGoalActionDependencies<T>(production: T): T {
  return (goalActionTestDependencies.getStore() as T | undefined) ?? production;
}

export function withGoalActionTestDependencies<TDependencies, TResult>(
  dependencies: TDependencies,
  work: () => Promise<TResult>,
): Promise<TResult> {
  return goalActionTestDependencies.run(dependencies, work);
}
