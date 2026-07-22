import type {
  BrainCommandHumanDiff,
  BrainCommandName,
} from "./command-registry";

export type BrainCommandPreviewServiceErrorCode =
  | "INVALID_INPUT"
  | "ACCESS_DENIED"
  | "PERSISTENCE_FAILED";

export class BrainCommandPreviewServiceError extends Error {
  constructor(public readonly code: BrainCommandPreviewServiceErrorCode) {
    super(`Brain command preview service failed: ${code}`);
    this.name = "BrainCommandPreviewServiceError";
  }
}

export type BrainCommandPreviewSummary = Readonly<{
  id: string;
  conversationId: string;
  userMessageId: string;
  commandName: BrainCommandName;
  status: "PREVIEWED" | "SUCCEEDED" | "REJECTED" | "EXPIRED";
  humanDiff: BrainCommandHumanDiff;
  previewExpiresAt: string;
  createdAt: string;
  terminalCode: string | null;
  terminalResult: unknown;
  expired: boolean;
}>;

export type BrainCommandPreviewList = Readonly<{
  schemaVersion: 1;
  previews: readonly BrainCommandPreviewSummary[];
}>;

export type BrainCommandPreviewListInput = Readonly<{
  schemaVersion: 1;
  conversationId?: string;
  limit?: number;
}>;

export type BrainCommandPreviewConfirmInput = Readonly<{
  schemaVersion: 1;
  previewId: string;
  mutationKey: string;
}>;

export type ParsedBrainCommandPreviewListInput = Readonly<{
  conversationId?: string;
  limit: number;
}>;

export type ParsedBrainCommandPreviewConfirmInput = Readonly<{
  previewId: string;
  mutationKey: string;
}>;
