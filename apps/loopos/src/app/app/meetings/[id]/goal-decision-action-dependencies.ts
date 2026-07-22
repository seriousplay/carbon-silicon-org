import { AsyncLocalStorage } from "node:async_hooks";

const goalDecisionActionTestDependencies = new AsyncLocalStorage<unknown>();

export function currentGoalDecisionActionDependencies<T>(production: T): T {
  return (goalDecisionActionTestDependencies.getStore() as T | undefined) ?? production;
}

export function withGoalDecisionActionTestDependencies<TDependencies, TResult>(
  dependencies: TDependencies,
  work: () => Promise<TResult>,
): Promise<TResult> {
  return goalDecisionActionTestDependencies.run(dependencies, work);
}
