export type RunType = "workshop" | "organization_diagnosis" | "cohort" | "public";

export type RunStatus = "draft" | "active" | "closed" | "archived";

export type AssessmentRun = {
  id?: string;
  slug: string;
  title: string;
  runType: RunType;
  status: RunStatus;
  audience?: string;
  description?: string;
  dateLabel?: string;
  accessCode?: string;
  organizationId?: string | null;
  showOnHome?: boolean;
  participantCount?: number;
  completedCount?: number;
  createdAt?: string;
};

export type CreateRunInput = {
  slug: string;
  title: string;
  runType: RunType;
  status: RunStatus;
  audience?: string;
  description?: string;
  date?: string;
  accessCode?: string;
  showOnHome?: boolean;
};
