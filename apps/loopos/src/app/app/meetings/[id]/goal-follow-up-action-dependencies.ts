import { AsyncLocalStorage } from "node:async_hooks";

const goalFollowUpActionTestDependencies = new AsyncLocalStorage<unknown>();

export function currentGoalFollowUpActionDependencies<T>(production: T): T {
  return (goalFollowUpActionTestDependencies.getStore() as T | undefined) ?? production;
}

export function withGoalFollowUpActionTestDependencies<TDependencies, TResult>(
  dependencies: TDependencies,
  work: () => Promise<TResult>,
): Promise<TResult> {
  return goalFollowUpActionTestDependencies.run(dependencies, work);
}
