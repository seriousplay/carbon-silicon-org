import { AsyncLocalStorage } from "node:async_hooks";

const setupActionTestDependencies = new AsyncLocalStorage<unknown>();

export function currentSetupActionDependencies<T>(production: T): T {
  return (setupActionTestDependencies.getStore() as T | undefined) ?? production;
}

export function withSetupActionTestDependencies<TDependencies, TResult>(
  dependencies: TDependencies,
  work: () => Promise<TResult>,
): Promise<TResult> {
  return setupActionTestDependencies.run(dependencies, work);
}
