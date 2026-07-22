import { AsyncLocalStorage } from "node:async_hooks";

const meetingActionTestDependencies = new AsyncLocalStorage<unknown>();

export function currentMeetingActionDependencies<T>(production: T): T {
  return (meetingActionTestDependencies.getStore() as T | undefined) ?? production;
}

export function withMeetingActionTestDependencies<TDependencies, TResult>(
  dependencies: TDependencies,
  work: () => Promise<TResult>,
): Promise<TResult> {
  return meetingActionTestDependencies.run(dependencies, work);
}
