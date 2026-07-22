import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPreferredCandidate,
  buildBlueprint,
  buildDiagnosisSummary,
  buildLoopSeed,
  getStageLadderItem,
  parseQuestionnaire,
} from "./workflow";

const questionnaire = parseQuestionnaire({
  name: "张三",
  company: "样本公司",
  role: "CEO",
  scale: "50-100 人",
  industry: "制造业",
  business: "小批量定制生产",
  aiConcern: "报价响应太慢，机会经常丢失",
  aiCurrentWork: "销售团队每周用 AI 整理客户需求，生产计划仍靠人工排程。",
  aiStageChoice: "B",
  aiScenarios: ["销售跟进 / 客户经营", "供应链 / 交付 / 运营"],
  aiBlockers: ["数据基础弱，AI 很难接进业务"],
  ninetyDayPriorityChoice: "A",
  aiAttitudeChoice: "C",
  orgManagementChoice: "B",
  humanAiDivisionChoice: "C",
  evolutionPathChoice: "A",
  expectations: ["设计一条 AI 业务回路"],
  takeaway: "一条能启动的回路",
});

test("parses questionnaire and rejects missing required fields", () => {
  assert.equal(questionnaire.company, "样本公司");
  assert.match(questionnaire.aiCurrentWork ?? "", /销售团队/);
  assert.deepEqual(questionnaire.aiScenarios, ["销售跟进 / 客户经营", "供应链 / 交付 / 运营"]);
  assert.equal(questionnaire.ninetyDayPriorityChoice, "A");
  assert.equal(questionnaire.orgManagementChoice, "B");
  assert.equal(questionnaire.humanAiDivisionChoice, "C");
  assert.equal(questionnaire.evolutionPathChoice, "A");
  assert.deepEqual(questionnaire.expectations, ["设计一条 AI 业务回路"]);
  assert.throws(() => parseQuestionnaire({}), /姓名/);
});

test("builds diagnosis summary from questionnaire and diagnosis responses", () => {
  const summary = buildDiagnosisSummary(questionnaire, {
    focusChoice: "speed",
    stageConfirmation: "我认为是 L3",
    stageContinuity: "方法还在个人经验里",
  });
  assert.equal(summary.focus, "speed");
  assert.equal(summary.stageLevel, "L3");
  assert.equal(summary.benchmark.length, 3);
});

test("builds diagnosis stage from 1-3-5 stage assessment scores", () => {
  const summary = buildDiagnosisSummary(questionnaire, {
    stageAssessment: JSON.stringify({ L1: 3, L2: 3, L3: 5, L4: 5, L5: 1 }),
  });
  assert.equal(summary.stageLevel, "L4");
  assert.equal(summary.stageName, "系统重写");
  assert.match(summary.stageReason, /L4 5分/);
});

test("stage ladder uses the closed-class five stage naming", () => {
  assert.equal(getStageLadderItem("L1").name, "工具上手");
  assert.equal(getStageLadderItem("L2").name, "流程接入");
  assert.equal(getStageLadderItem("L3").name, "团队重构");
  assert.equal(getStageLadderItem("L4").name, "系统重写");
  assert.equal(getStageLadderItem("L5").name, "碳硅共生");
  assert.match(getStageLadderItem("L5").upgradeCost, /组织记忆/);
});

test("blueprint generation requires three manually scored seed loops", () => {
  assert.throws(() => buildBlueprint(questionnaire, { painPoint: "每天手动整理需求，报价滞后" }), /3 个候选火种回路/);
  assert.throws(() => buildBlueprint(questionnaire, {
    seedLoopSelection: JSON.stringify({
      scoreWeights: { pain: 40, data: 30, replication: 30, riskControl: 10 },
    }),
  }), /评分权重合计必须等于 100%/);
});

test("builds strategic blueprint context and seed loop handoff", () => {
  const blueprint = buildBlueprint(questionnaire, {
    strategicIdentity: JSON.stringify({
      company: "样本公司",
      industry: "制造业",
      business: "小批量定制生产",
      scale: "50-100 人",
      mission: "让定制生产更快响应客户",
      vision: "成为 AI 驱动的柔性制造组织",
      businessEssence: "流程驱动",
      essenceNote: "靠流程和交付稳定性赢",
    }),
    focusStrategy: JSON.stringify({
      weights: { speed: 50, connection: 30, emergence: 20 },
      metric: "报价响应周期",
      tradeoff: "接受报价流程重排",
      visionAlignment: "速度服务柔性制造愿景",
    }),
    strategicBattlefield: JSON.stringify({
      name: "报价响应 AI 突破战",
      scope: "core",
      strategicGoal: "把报价响应从天级压缩到小时级",
      twelveMonthOutcome: "形成可复制的柔性报价系统",
      urgency: "客户窗口期越来越短",
    }),
    readinessAssessment: JSON.stringify({
      structure: { score: 3, gap: "报价责任边界需明确" },
      cell: { score: 5, gap: "业务骨干可投入试点" },
      environment: { score: 3, gap: "历史报价数据需要清洗" },
    }),
    seedLoopSelection: JSON.stringify({
      manualCandidates: [
        {
          title: "SKU 文案上新回路",
          pain: "每次上新几百个 SKU，文案写得手抽筋，外包质量不稳定",
          data: "上架速度、文案点击率、转化率可追踪",
          owner: "运营负责人愿意试，因为直接影响她的上新效率",
          shortLoop: "4-6周能跑通，并且业务结果可被验证",
          scores: { pain: 5, data: 5, replication: 5, riskControl: 3 },
        },
        {
          title: "报价材料复核回路",
          pain: "报价材料经常来回确认",
          data: "报价周期可追踪",
          owner: "销售负责人愿意试",
          shortLoop: "两周内可以跑一批样例",
          scores: { pain: 3, data: 3, replication: 3, riskControl: 5 },
        },
        {
          title: "生产排程提醒回路",
          pain: "排程提醒不稳定",
          data: "排程延迟有记录",
          owner: "生产主管愿意试",
          shortLoop: "一周内可以做提醒",
          scores: { pain: 3, data: 3, replication: 1, riskControl: 3 },
        },
      ],
    }),
  });

  assert.equal(blueprint.strategicContext.vision, "成为 AI 驱动的柔性制造组织");
  assert.equal(blueprint.battlefield.name, "报价响应 AI 突破战");
  assert.match(blueprint.readiness.primaryRisk, /报价责任边界需明确|历史报价数据需要清洗/);
  assert.match(blueprint.strategicNarrative, /报价响应 AI 突破战/);
  assert.ok(blueprint.recommendedSeedLoop);
  assert.equal(blueprint.candidates.length, 3);
  assert.equal(blueprint.recommendedSeedLoop.title, "SKU 文案上新回路");
  assert.equal(blueprint.candidates[0].seedLoopWeightedScore, 96);
  assert.match(blueprint.candidates[0].evidence, /痛点 40%、数据 30%、复制潜力 20%、风险可控度 10%/);
  assert.match(blueprint.candidates[0].successCriteria, /4-6周/);
  const selected = applyPreferredCandidate(blueprint, "candidate_2");
  assert.equal(selected.preferredCandidateId, "candidate_2");
  assert.match(buildLoopSeed(blueprint.candidates[0], blueprint), /关键战场：报价响应 AI 突破战/);
  assert.match(buildLoopSeed(blueprint.candidates[0], blueprint), /建议回路：SKU 文案上新回路/);
  assert.match(buildLoopSeed(blueprint.candidates[0], blueprint), /AI 应用现状：销售团队每周用 AI 整理客户需求/);
});

test("blueprint seed loop scoring honors user-adjusted weights", () => {
  const blueprint = buildBlueprint(questionnaire, {
    seedLoopSelection: JSON.stringify({
      scoreWeights: { pain: 10, data: 10, replication: 70, riskControl: 10 },
      manualCandidates: [
        {
          title: "强痛点低复制回路",
          pain: "报价延迟每天发生，直接影响成交",
          data: "报价周期和成交损失可追踪",
          owner: "销售负责人愿意试",
          shortLoop: "4-6周能跑通，并且业务结果可被验证",
          scores: { pain: 5, data: 5, replication: 1, riskControl: 5 },
        },
        {
          title: "可复制模板回路",
          pain: "报价模板经常重复整理",
          data: "模板复用率和报价周期可追踪",
          owner: "运营负责人愿意试",
          shortLoop: "4-6周能跑通，并且业务结果可被验证",
          scores: { pain: 3, data: 3, replication: 5, riskControl: 3 },
        },
        {
          title: "低风险提醒回路",
          pain: "客户提醒偶尔漏掉",
          data: "提醒触达率可追踪",
          owner: "客服负责人愿意试",
          shortLoop: "4-6周能跑通，并且业务结果可被验证",
          scores: { pain: 3, data: 3, replication: 3, riskControl: 5 },
        },
      ],
    }),
  });

  assert.equal(blueprint.recommendedSeedLoop.title, "可复制模板回路");
  assert.equal(blueprint.candidates[0].seedLoopWeights?.replication, 70);
  assert.equal(blueprint.candidates[0].seedLoopWeightedScore, 88);
  assert.match(blueprint.candidates[0].evidence, /复制潜力 70%/);
});
