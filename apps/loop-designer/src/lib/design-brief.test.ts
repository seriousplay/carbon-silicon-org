import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScenarioDiagnosis,
  normalizeLoopCells,
  parseBusinessGoalAnchor,
  parseWorkflowInput,
  serializeBusinessGoalAnchor,
  serializeWorkflowInput,
  serializeWorkflowStepLines,
  stepsFromWorkflowNarrative,
} from "./design-brief";

test("business goal anchor round-trips the lightweight structured fields", () => {
  const anchor = parseBusinessGoalAnchor(serializeBusinessGoalAnchor({
    intent: "减少需求澄清反复。",
    goal: "把确认周期压缩到 48 小时。",
    output: "结构化需求单。",
    successSignal: "一次确认率提升。",
    cycle: "一个项目交付周期",
    constraints: "高风险承诺必须由人确认。",
  }));

  assert.deepEqual(anchor, {
    intent: "减少需求澄清反复。",
    goal: "把确认周期压缩到 48 小时。",
    output: "结构化需求单。",
    successSignal: "一次确认率提升。",
    cycle: "一个项目交付周期",
    constraints: "高风险承诺必须由人确认。",
  });
});

test("business goal anchor serialization tolerates legacy partial blueprint values", () => {
  const serialized = serializeBusinessGoalAnchor({
    intent: "旧版蓝图种子",
    goal: undefined,
    output: "客户反馈回路",
    successSignal: undefined,
    cycle: "由本次设计确认",
    constraints: undefined,
  } as unknown as Parameters<typeof serializeBusinessGoalAnchor>[0]);

  assert.match(serialized, /目标：待补齐/);
  assert.match(serialized, /成功标志：待补齐/);
  assert.match(serialized, /不可牺牲约束：待补齐/);
});

test("workflow narrative derives diagnosis without global participant/system fields", () => {
  const workflow = serializeWorkflowInput({
    mode: "current",
    narrative: "第一步客户在群里提出需求。\n第二步业务整理到表格。\n第三步交付评估风险。",
  });

  assert.equal(parseWorkflowInput(workflow)?.mode, "current");

  const diagnosis = buildScenarioDiagnosis({
    workflow,
  });
  assert.equal(diagnosis.stageMapping.length, 5);
  assert.equal(diagnosis.stageMapping[0].sourceStep, "客户在群里提出需求。");
  assert.ok(diagnosis.collaborationOpportunities.some((item) => item.type === "人工搬运"));
  assert.ok(diagnosis.collaborationOpportunities.some((item) => item.governanceRule.includes("留")));
});

test("workflow sandbox steps serialize back to natural workflow lines", () => {
  const narrative = serializeWorkflowStepLines([
    "客户说：需要一个定制方案。",
    "销售整理需求并同步给产品。",
    "交付确认风险和周期。",
  ]);

  assert.equal(
    narrative,
    "第一步客户说：需要一个定制方案。\n第二步销售整理需求并同步给产品。\n第三步交付确认风险和周期。",
  );

  const parsed = parseWorkflowInput(serializeWorkflowInput({
    mode: "current",
    narrative,
  }));

  assert.equal(parsed?.mode, "current");
  assert.deepEqual(stepsFromWorkflowNarrative(parsed?.narrative), [
    "客户说：需要一个定制方案。",
    "销售整理需求并同步给产品。",
    "交付确认风险和周期。",
  ]);
});

test("loop cells round-trip business facts for agentability diagnosis", () => {
  const workflow = serializeWorkflowInput({
    mode: "current",
    narrative: "",
    cells: [{
      id: "cell-script",
      action: "品牌总监撰写脚本初稿。",
      owner: "品牌总监负责脚本质量。",
      trigger: "需求 brief 确认后。",
      input: "产品知识卡片、历史案例、需求 brief。",
      output: "脚本初稿。",
      decision: "判断故事线和客户价值表达。",
      system: "飞书文档、知识库。",
      acceptance: "脚本可以进入审定。",
      exceptionOwner: "品牌总监。",
      memory: "沉淀脚本版本、审核意见和采用理由。",
      friction: "品牌视频经验留在个人脑中。",
    }],
  });

  const parsed = parseWorkflowInput(workflow);
  const cells = normalizeLoopCells(parsed ?? { mode: "current", narrative: "" });
  assert.equal(cells[0].action, "品牌总监撰写脚本初稿。");
  assert.equal(cells[0].memory, "沉淀脚本版本、审核意见和采用理由。");

  const diagnosis = buildScenarioDiagnosis({ workflow });
  assert.equal(diagnosis.cellDiagnostics[0].recommendedMode, "知识增强执行");
  assert.equal(diagnosis.cellDiagnostics[0].heat, "green");
  assert.ok(diagnosis.priorityActions.some((item) => item.recommendedMode === "知识增强执行"));
});

test("brand video workflow maps loop cells to business improvement modes", () => {
  const actions = [
    "S1 需求发起：需求方口头提出视频需求。",
    "S2 需求确认：品牌总监和需求方确认视频方向。",
    "S3 脚本初稿：品牌总监撰写脚本初稿。",
    "S4 脚本审定：多方在群聊里审定脚本。",
    "S5 视频初稿：品牌运营在即梦和剪映之间制作视频初稿。",
    "S6 视频审核：需求方和品牌总监审核视频。",
    "S7 视频修改：品牌运营根据意见修改版本。",
    "S8 CEO终审：CEO 做最终确认。",
    "S9 发布：品牌运营多平台发布。",
  ];
  const workflow = serializeWorkflowInput({
    mode: "current",
    narrative: serializeWorkflowStepLines(actions),
    cells: actions.map((action, index) => ({
      id: `video-${index + 1}`,
      action,
      owner: action.includes("需求发起") ? "需求方发起" : "待确认",
      trigger: action.includes("需求发起") ? "出现视频需求" : "待确认",
      input: action.includes("需求发起") ? "口头描述和截图" : "待确认",
      output: action.includes("发布") ? "发布内容" : "待确认",
      decision: action.includes("CEO") ? "是否通过终审" : "待确认",
      system: action.includes("视频初稿") ? "即梦、剪映，暂时不能自动接 API" : "待确认",
      acceptance: action.includes("发布") ? "发布成功并留痕" : "待确认",
      exceptionOwner: "",
      memory: "",
      friction: "待确认",
    })),
  });

  const diagnosis = buildScenarioDiagnosis({ workflow });
  const modes = diagnosis.cellDiagnostics.map((item) => item.recommendedMode);
  assert.deepEqual(modes, [
    "结构化入口",
    "结构化入口",
    "知识增强执行",
    "异步共创审议",
    "工具链编排",
    "异步共创审议",
    "异步共创审议",
    "前置透明决策",
    "模板化自动发布",
  ]);
});

test("agentability diagnosis treats missing facts as gaps instead of inventing readiness", () => {
  const workflow = serializeWorkflowInput({
    mode: "current",
    narrative: "第一步品牌运营在即梦和剪映之间制作视频初稿。",
    cells: [{
      id: "cell-video",
      action: "品牌运营在即梦和剪映之间制作视频初稿。",
      owner: "品牌运营",
      trigger: "",
      input: "脚本初稿",
      output: "视频初稿",
      decision: "",
      system: "即梦、剪映，暂时不能自动接 API",
      acceptance: "",
      exceptionOwner: "",
      memory: "",
      friction: "人工搬运素材并串联工具。",
    }],
  });

  const diagnosis = buildScenarioDiagnosis({ workflow });
  const cell = diagnosis.cellDiagnostics[0];
  assert.equal(cell.recommendedMode, "工具链编排");
  assert.ok(cell.blockers.some((item) => item.includes("异常是否有人接管")));
  assert.ok(cell.checks.some((item) => item.label === "经验能否复用" && item.status === "缺失"));
  assert.doesNotMatch(`${cell.currentAiCapability} ${cell.nextFill.join(" ")}`, /可自动调用 API/);
});
