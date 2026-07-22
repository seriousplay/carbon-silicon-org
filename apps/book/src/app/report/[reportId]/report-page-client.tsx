"use client";

import { useMemo } from "react";
import { AppShell, Container } from "@/components/ui";
import { ReportView } from "@/components/report-view";
import { getLocalReport } from "@/lib/assessment/storage";
import { buildReport, demoParticipant } from "@/lib/assessment/scoring";
import type { Report } from "@/lib/assessment/types";

const demoAnswers = {
  stage_l1: "stable",
  stage_l2: "stable",
  stage_l3: "occasional",
  stage_l4: "not_yet",
  stage_l5: "not_yet",
  spiral_structure_1: 3,
  spiral_structure_2: 2,
  spiral_structure_3: 3,
  spiral_cell_1: 2,
  spiral_cell_2: 2,
  spiral_cell_3: 3,
  spiral_environment_1: 3,
  spiral_environment_2: 2,
  spiral_environment_3: 2,
  energy_meaning_1: 3,
  energy_meaning_2: 3,
  energy_meaning_3: 2,
  energy_power_1: 2,
  energy_power_2: 2,
  energy_power_3: 2,
  energy_trust_1: 3,
  energy_trust_2: 2,
  energy_trust_3: 2,
  chain_1: 4,
  chain_2: 3,
  chain_3: 3,
  chain_4: 2,
  chain_5: 2,
  charter_1: 2,
  charter_2: 2,
  charter_3: 2,
  charter_4: 3,
  charter_5: 2,
  open_scenario: "AI 帮大家写材料变快了，但流程、验收和责任没有改变。",
  open_workflow: "绩效反馈材料整理和管理者一对一辅导准备。",
  open_blocker: "主要来自权力和信任：试点团队没有调整流程的授权，也缺少复核机制。",
};

export function ReportPageClient({ reportId, remoteReport }: { reportId: string; remoteReport: Report | null }) {
  const report: Report = useMemo(
    () => getLocalReport(reportId) ?? remoteReport ?? buildReport("demo", demoParticipant, demoAnswers, "demo"),
    [remoteReport, reportId],
  );

  return (
    <AppShell>
      <Container className="max-w-6xl py-10">
        <ReportView report={report} />
      </Container>
    </AppShell>
  );
}
