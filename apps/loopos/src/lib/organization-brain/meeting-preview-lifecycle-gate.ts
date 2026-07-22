import { evaluateMeetingLifecycle } from "@/lib/organization-setup/meeting-lifecycle-policy";
import { BrainCommandPreviewServiceError } from "./command-preview-types";

export async function createLedgerForMeetingLifecycle<Row>(
  lifecycleStatus: unknown,
  createLedger: () => Promise<Row>,
): Promise<Row> {
  if (!evaluateMeetingLifecycle(lifecycleStatus).allowed) {
    throw new BrainCommandPreviewServiceError("ACCESS_DENIED");
  }
  return createLedger();
}
