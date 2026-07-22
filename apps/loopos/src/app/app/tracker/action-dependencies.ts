import { AsyncLocalStorage } from "node:async_hooks";

const trackerActionTestDependencies = new AsyncLocalStorage<unknown>();

export function currentTrackerActionDependencies<T>(production: T): T {
  return (trackerActionTestDependencies.getStore() as T | undefined) ?? production;
}

export function withTrackerActionTestDependencies<TDependencies, TResult>(
  dependencies: TDependencies,
  work: () => Promise<TResult>,
): Promise<TResult> {
  return trackerActionTestDependencies.run(dependencies, work);
}
