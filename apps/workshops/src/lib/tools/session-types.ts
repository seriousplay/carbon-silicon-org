export type ToolSessionProfile = {
  displayName: string;
  role?: string;
  companyName?: string;
  teamName?: string;
  contact?: string;
};

export type ToolSessionReport = {
  title: string;
  summary: string;
  scores?: Record<string, number>;
  weakestSignal?: string;
  keyFindings: string[];
  riskSignals: string[];
  recommendedActions: string[];
  recommendedTools: string[];
};

export type ToolSessionDetail = {
  id: string;
  toolId: string;
  toolName: string;
  submittedAt: string;
  mode: string;
  participantSnapshot: Record<string, string | undefined>;
  context: Record<string, string | undefined>;
  responses: Record<string, string>;
  outputs: Record<string, unknown>;
  report: ToolSessionReport;
};
