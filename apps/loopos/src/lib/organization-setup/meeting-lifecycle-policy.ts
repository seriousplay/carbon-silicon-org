export const MEETING_LIFECYCLE_DENIAL_CODE = "ORGANIZATION_NOT_ACTIVE";

export type MeetingLifecycleDecision =
  | { allowed: true }
  | { allowed: false; code: typeof MEETING_LIFECYCLE_DENIAL_CODE };

export function evaluateMeetingLifecycle(
  lifecycleStatus: unknown,
): MeetingLifecycleDecision {
  return lifecycleStatus === "ACTIVE"
    ? { allowed: true }
    : { allowed: false, code: MEETING_LIFECYCLE_DENIAL_CODE };
}
