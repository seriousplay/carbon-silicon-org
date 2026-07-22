import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("home page exposes session rename and delete controls", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  const list = readFileSync("src/components/session-list.tsx", "utf8");
  const route = readFileSync("src/app/api/sessions/[sessionId]/route.ts", "utf8");
  assert.match(page, /SessionList/);
  assert.match(list, /重命名/);
  assert.match(list, /删除/);
  assert.match(list, /window\.confirm/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function DELETE/);
});

test("home page exposes a loop inbox instead of auto-entering locked blueprint loops", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  const sessions = readFileSync("src/lib/sessions.ts", "utf8");
  const route = readFileSync("src/app/api/sessions/route.ts", "utf8");
  const button = readFileSync("src/components/new-session-button.tsx", "utf8");
  const workspace = readFileSync("src/components/designer-workspace.tsx", "utf8");
  const list = readFileSync("src/components/session-list.tsx", "utf8");

  assert.match(page, /listLoopInboxSessions/);
  assert.match(page, /listCompletedLoopDesignSessions/);
  assert.match(page, /Promise\.all/);
  assert.match(page, /href="\/profile"/);
  assert.match(page, /用户：/);
  assert.doesNotMatch(page, /飞书用户/);
  assert.match(page, /回路 Inbox/);
  assert.match(page, /开始此回路设计/);
  assert.doesNotMatch(page, /查看蓝图/);
  assert.ok(page.indexOf("构建一条新的业务回路") < page.indexOf("回路资产台"));
  assert.ok(page.indexOf("回路 Inbox") < page.indexOf("组织记忆"));
  assert.match(page, /变成可复用的企业回路清单/);
  assert.match(page, /下一次设计不再从零开始/);
  assert.ok(page.indexOf("completedLoopDesigns.length") < page.indexOf('label="ASSETS"'));
  assert.match(route, /sourceSessionId/);
  assert.match(button, /sourceSessionId/);
  assert.match(sessions, /getPreferredBlueprintFromSession/);
  assert.match(sessions, /normalizeInboxLoopKey/);
  assert.match(sessions, /listCompletedLoopDesignSessions/);
  assert.match(sessions, /outputs->currentPlan/);
  assert.match(sessions, /currentStep: 0/);
  assert.doesNotMatch(sessions, /currentStep: preferredCandidate \? 1 : 0/);
  assert.doesNotMatch(sessions, /getLatestPreferredBlueprint/);
  assert.match(workspace, /parseBusinessGoalAnchor/);
  assert.match(list, /COMPLETED LOOP DESIGNS/);
});

test("plan cell runtime patch updates the current plan without creating a refinement version", () => {
  const route = readFileSync("src/app/api/sessions/[sessionId]/plan/cells/route.ts", "utf8");
  const sessions = readFileSync("src/lib/sessions.ts", "utf8");
  const serviceStart = sessions.indexOf("export async function updateLoopPlanCellRuntime");
  const serviceEnd = sessions.indexOf("export async function deleteSession");
  const service = sessions.slice(serviceStart, serviceEnd);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /runtimePatchSchema/);
  assert.match(route, /toBeActorAssignmentSchema/);
  assert.match(route, /toBeTimeEstimateSchema/);
  assert.match(service, /loopPlanSchema\.safeParse/);
  assert.match(service, /currentPlan: parsedPlan\.data/);
  assert.doesNotMatch(service, /refinementCount/);
  assert.doesNotMatch(service, /versions:/);
});

test("prework 624 exposes questionnaire-only entry", () => {
  const page = readFileSync("src/app/prework/624/page.tsx", "utf8");
  const loginForm = readFileSync("src/components/prework-login-form.tsx", "utf8");
  const route = readFileSync("src/app/api/prework/624/login/route.ts", "utf8");
  const thanks = readFileSync("src/app/prework/624/thanks/page.tsx", "utf8");
  const questionnaire = readFileSync("src/components/questionnaire-workspace.tsx", "utf8");
  const questionnaireRoute = readFileSync("src/app/api/sessions/[sessionId]/questionnaire/route.ts", "utf8");
  assert.match(loginForm, /课前问卷入口/);
  assert.match(loginForm, /type="hidden" name="accessCode" value="CSI2026SZ"/);
  assert.match(loginForm, /name="phone"/);
  assert.match(page, /唯一标识/);
  assert.match(loginForm, /请输入您的手机号/);
  assert.doesNotMatch(page, /班主任发送二维码/);
  assert.doesNotMatch(page, /扫码直接进入本页/);
  assert.doesNotMatch(page, /活动码<\/span>/);
  assert.doesNotMatch(page, /companyName/);
  assert.match(route, /CSI2026SZ/);
  assert.match(questionnaire, /电商 \/ 直播电商/);
  assert.match(questionnaire, /跨境电商/);
  assert.match(questionnaire, /企业目前 AI 应用最多的场景/);
  assert.match(questionnaire, /企业现在的组织管理方式/);
  assert.match(questionnaire, /企业现在“人和 AI 的分工”清楚吗/);
  assert.match(questionnaire, /未来 90 天只推动一件 AI 组织变化/);
  assert.match(questionnaire, /您觉得企业更适合先走哪条 AI 组织进化路径/);
  assert.match(questionnaire, /面对 AI 的冲击，最让您感到焦虑的/);
  assert.match(questionnaire, /aiScenarios/);
  assert.match(questionnaire, /aiBlockers/);
  assert.match(questionnaire, /orgManagementChoice/);
  assert.match(questionnaire, /humanAiDivisionChoice/);
  assert.match(questionnaire, /evolutionPathChoice/);
  assert.match(route, /getOrCreatePreworkQuestionnaireSession/);
  assert.match(thanks, /问卷已提交/);
  assert.match(questionnaireRoute, /prework_624/);
});

test("main login uses phone and password event login", () => {
  const loginClient = readFileSync("src/app/auth/login/login-client.tsx", "utf8");
  const quickLoginRoute = readFileSync("src/app/api/auth/event/quick-login/route.ts", "utf8");
  const eventAuth = readFileSync("src/lib/event-auth.ts", "utf8");
  const appSession = readFileSync("src/lib/app-session.ts", "utf8");
  assert.match(loginClient, /name="phone"/);
  assert.match(loginClient, /name="password"/);
  assert.match(loginClient, /name="passwordConfirm"/);
  assert.match(loginClient, /两次输入的密码不一致/);
  assert.match(quickLoginRoute, /passwordConfirm/);
  assert.match(loginClient, /用于登录碳硅组织设计工作室的唯一标识/);
  assert.match(loginClient, /首次登录将设置密码/);
  assert.doesNotMatch(loginClient, /CEO 组织进化工作室/);
  assert.doesNotMatch(loginClient, /name="accessCode"/);
  assert.doesNotMatch(loginClient, /name="displayName"/);
  assert.doesNotMatch(loginClient, /name="companyName"/);
  assert.doesNotMatch(loginClient, /活动码/);
  assert.match(quickLoginRoute, /quickLoginWithEventPhone/);
  assert.match(quickLoginRoute, /password/);
  assert.match(eventAuth, /requirePassword: true/);
  assert.match(eventAuth, /requestedDisplayName/);
  assert.match(eventAuth, /requestedCompanyName/);
  assert.match(eventAuth, /bcrypt\.compare/);
  assert.doesNotMatch(quickLoginRoute, /body\.accessCode/);
  assert.match(appSession, /void admin\s+\.from\("loop_designer_auth_sessions"\)\s+\.update\(\{ last_seen_at: now \}\)/);
});

test("public start routes preserve login next targets and create the right workflow", () => {
  const questionnaireRoute = readFileSync("src/app/start/questionnaire/route.ts", "utf8");
  const blueprintRoute = readFileSync("src/app/start/blueprint/route.ts", "utf8");
  const loopRoute = readFileSync("src/app/start/loop-design/route.ts", "utf8");
  assert.match(questionnaireRoute, /startPath = "\/loop-designer\/start\/questionnaire"/);
  assert.match(questionnaireRoute, /auth\/login\?next/);
  assert.match(questionnaireRoute, /request: Request/);
  assert.match(questionnaireRoute, /forwardedRequestOrigin/);
  assert.match(questionnaireRoute, /new URL\(`\/loop-designer\/sessions\/\$\{session\.id\}\/questionnaire`, requestOrigin\)/);
  assert.match(questionnaireRoute, /workflow: "questionnaire"/);
  assert.match(blueprintRoute, /startPath = "\/loop-designer\/start\/blueprint"/);
  assert.match(blueprintRoute, /auth\/login\?next/);
  assert.match(blueprintRoute, /request: Request/);
  assert.match(blueprintRoute, /forwardedRequestOrigin/);
  assert.match(blueprintRoute, /getOrCreateBlueprintSession/);
  assert.match(blueprintRoute, /session\.context\.workflowStage === "blueprint"/);
  assert.match(blueprintRoute, /`\/loop-designer\/sessions\/\$\{session\.id\}\/blueprint`/);
  assert.match(blueprintRoute, /`\/loop-designer\/sessions\/\$\{session\.id\}\/diagnosis`/);
  assert.doesNotMatch(blueprintRoute, /publicUrl/);
  assert.match(loopRoute, /startPath = "\/loop-designer\/start\/loop-design"/);
  assert.match(loopRoute, /auth\/login\?next/);
  assert.match(loopRoute, /request: Request/);
  assert.match(loopRoute, /forwardedRequestOrigin/);
  assert.match(loopRoute, /new URL\(`\/loop-designer\/sessions\/\$\{session\.id\}`, requestOrigin\)/);
  assert.doesNotMatch(loopRoute, /publicUrl/);
  assert.match(loopRoute, /workflow: "loop_design"/);
  assert.match(loopRoute, /sessions\/\$\{session\.id\}`/);
});

test("local dev config allows 127 loop-designer entry assets", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /basePath: "\/loop-designer"/);
  assert.match(config, /assetPrefix: "\/loop-designer"/);
  assert.match(config, /allowedDevOrigins: \["127\.0\.0\.1"\]/);
});

test("blueprint diagnosis APIs return loop-designer scoped next paths", () => {
  const diagnosisRoute = readFileSync("src/app/api/sessions/[sessionId]/diagnosis/route.ts", "utf8");
  const preferredRoute = readFileSync("src/app/api/sessions/[sessionId]/blueprint/preferred/route.ts", "utf8");
  const sessions = readFileSync("src/lib/sessions.ts", "utf8");
  const model = readFileSync("src/lib/model.ts", "utf8");

  assert.match(diagnosisRoute, /`\/sessions\/\$\{session\.id\}\/blueprint`/);
  assert.match(diagnosisRoute, /`\/sessions\/\$\{session\.id\}\/diagnosis`/);
  assert.doesNotMatch(diagnosisRoute, /nextUrl = complete \? `\/loop-designer\/sessions/);
  assert.match(sessions, /const complete = nextStep >= DIAGNOSIS_STEPS\.length/);
  assert.match(sessions, /generateBlueprintWithInsights\(buildBlueprint\(session\.context\.questionnaire, diagnosis\)\)/);
  assert.match(sessions, /generateBlueprintStrategicInsightsWithModel\(blueprint\)/);
  assert.match(sessions, /diagnosisSummary: blueprint\.diagnosis, blueprint/);
  assert.match(model, /generateBlueprintStrategicInsightsWithModel/);
  assert.match(model, /模型服务未配置，无法生成真实 LLM 蓝图洞察/);
  assert.match(model, /BLUEPRINT_INSIGHT_SYSTEM_PROMPT/);
  assert.match(preferredRoute, /nextUrl: "\/"/);
});

test("studio page owns the shared entry and global home affordance", () => {
  const studioPage = readFileSync("src/app/studio/page.tsx", "utf8");
  const studioEntryGrid = readFileSync("src/components/studio-entry-grid.tsx", "utf8");
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const homeButton = readFileSync("src/components/studio-home-button.tsx", "utf8");
  const logoutRoute = readFileSync("src/app/api/auth/logout/route.ts", "utf8");

  assert.match(studioPage, /getCurrentUser/);
  assert.match(studioPage, /StudioEntryGrid/);
  assert.match(studioPage, /碳硅组织进化工作室/);
  assert.match(studioPage, /AI时代领导者的组织设计工具集/);
  assert.match(studioPage, /href: "\/start\/questionnaire"/);
  assert.match(studioPage, /href: "\/start\/blueprint"/);
  assert.match(studioPage, /href: "\/start\/loop-design"/);
  assert.match(studioPage, /正在进入问卷/);
  assert.match(studioPage, /正在启动蓝图/);
  assert.match(studioPage, /正在建立回路/);
  assert.match(studioEntryGrid, /loadingHref/);
  assert.match(studioEntryGrid, /event\.preventDefault/);
  assert.match(studioEntryGrid, /router\.push\(entry\.href\)/);
  assert.match(studioEntryGrid, /window\.setTimeout/);
  assert.match(studioEntryGrid, /cursor-wait/);
  assert.match(studioPage, /auth\/login\?next=\/loop-designer\/studio/);
  assert.match(studioPage, /api\/auth\/logout\?next=\/loop-designer\/studio/);
  assert.match(layout, /StudioHomeButton/);
  assert.match(homeButton, /href="\/studio"/);
  assert.match(homeButton, /工作室主页/);
  assert.match(logoutRoute, /safeLogoutNext/);
  assert.match(logoutRoute, /value === "\/loop-designer"/);
  assert.match(logoutRoute, /value\.startsWith\("\/loop-designer\/"\)/);
});

test("diagnosis workspace keeps blueprint save action visible", () => {
  const workspace = readFileSync("src/components/diagnosis-workspace.tsx", "utf8");
  const actionBarIndex = workspace.indexOf("sticky top-3");
  const treeIndex = workspace.indexOf("DiagnosisTree currentIndex");
  const formIndex = workspace.indexOf("StrategicIdentityForm");
  const bottomButtonIndex = workspace.indexOf("mt-6 inline-flex items-center gap-2 bg-[var(--acid)]");

  assert.notEqual(actionBarIndex, -1);
  assert.notEqual(treeIndex, -1);
  assert.notEqual(formIndex, -1);
  assert.ok(actionBarIndex < treeIndex);
  assert.ok(actionBarIndex < formIndex);
  assert.match(workspace, /type="button"/);
  assert.equal(bottomButtonIndex, -1);
  assert.match(workspace, /保存并继续/);
  assert.match(workspace, /生成战略蓝图/);
});

test("diagnosis workspace autosaves server drafts before formal submit", () => {
  const workspace = readFileSync("src/components/diagnosis-workspace.tsx", "utf8");
  const route = readFileSync("src/app/api/sessions/[sessionId]/diagnosis/draft/route.ts", "utf8");
  const sessions = readFileSync("src/lib/sessions.ts", "utf8");
  const sessionTypes = readFileSync("src/lib/session-types.ts", "utf8");

  assert.match(sessionTypes, /diagnosisDrafts\?: Partial<DiagnosisResponses>/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /saveDiagnosisDraft/);
  assert.match(route, /stepId: body\.stepId \?\? ""/);
  assert.match(route, /answer: body\.answer \?\? ""/);
  assert.match(sessions, /export async function saveDiagnosisDraft/);
  assert.match(sessions, /DIAGNOSIS_STEPS\.find\(\(item\) => item\.id === input\.stepId\)/);
  assert.match(sessions, /input\.answer\.length > 6000/);
  assert.match(sessions, /diagnosisDrafts/);
  assert.match(sessions, /delete diagnosisDrafts\[step\.id\]/);
  assert.match(sessions, /export async function getOrCreateBlueprintSession/);
  assert.match(sessions, /hasBlueprintDiagnosisWork/);
  assert.match(workspace, /diagnosis\/draft/);
  assert.match(workspace, /window\.setTimeout\(async \(\) =>/);
  assert.match(workspace, /}, 800\)/);
  assert.match(workspace, /草稿已自动保存/);
  assert.match(workspace, /readDiagnosisValues/);
  assert.match(workspace, /响应周期、转化率、复购率、交付周期或决策周期/);
  assert.match(workspace, /减少并行项目、重排职责、牺牲局部效率、接受试点扰动/);
  assert.match(workspace, /未来 12 个月结果/);
});

test("blueprint diagnosis uses user-written seed loops and high-value scoring", () => {
  const workspace = readFileSync("src/components/diagnosis-workspace.tsx", "utf8");
  const workflow = readFileSync("src/lib/workflow.ts", "utf8");
  const blueprint = readFileSync("src/components/blueprint-workspace.tsx", "utf8");

  assert.match(workspace, /基于这个组织能力聚焦方向，最需要提升的战略指标/);
  assert.match(workspace, /为此，组织上短时间必须要接受的代价/);
  assert.match(workspace, /这个能力聚焦方向与长期业务愿景的关系/);
  assert.doesNotMatch(workspace, /哪条链路可在 4-6 周内试点/);
  assert.match(workspace, /通过这场仗，核心要实现的战略意图/);
  assert.match(workspace, /怎么才算赢/);
  assert.match(workspace, /LOOP OPTION 0/);
  assert.match(workspace, /真痛点/);
  assert.match(workspace, /有数据/);
  assert.match(workspace, /有人扛/);
  assert.match(workspace, /闭环短/);
  assert.match(workspace, /排序权重/);
  assert.match(workspace, /合计 \{weightTotal\}%/);
  assert.match(workspace, /updateScoreWeight/);
  assert.match(workspace, /scoreWeights\[criterion\.key\]/);
  assert.match(workspace, /评分权重合计必须等于 100%/);
  assert.match(workflow, /4-6周能跑通，并且业务结果可被验证/);
  assert.match(workflow, /DEFAULT_SEED_LOOP_SCORE_WEIGHTS/);
  assert.match(workflow, /scoreWeights\?: SeedLoopScoreWeights/);
  assert.match(workflow, /scoreSeedLoopCandidate\(right, scoreWeights\)/);
  assert.match(workflow, /按痛点 \$\{scoreWeights\.pain\}%/);
  assert.match(workflow, /manualCandidates/);
  assert.match(blueprint, /HIGH VALUE SCORE/);
  assert.match(blueprint, /seedLoopScores\.replication/);
  assert.match(blueprint, /seedLoopScores\.riskControl/);
  assert.match(workflow, /BlueprintStrategicInsights/);
  assert.match(blueprint, /AI 生成洞察/);
  assert.match(blueprint, /LLM STRATEGIC INSIGHTS/);
  assert.match(blueprint, /strategicInsights/);
  assert.match(blueprint, /blueprint\/exports\/\$\{kind\}/);
  assert.match(blueprint, /Download/);
  assert.match(blueprint, /Markdown/);
  assert.match(blueprint, /PDF/);
  assert.match(blueprint, /StageLadderPanel/);
  assert.match(blueprint, /五级阶梯/);
  assert.match(blueprint, /getStageLadderItem/);
  assert.match(workflow, /工具上手/);
  assert.match(workflow, /流程接入/);
  assert.match(workflow, /团队重构/);
  assert.match(workflow, /系统重写/);
  assert.match(workflow, /碳硅共生/);
});

test("profile page lets phone users edit basic account settings", () => {
  const profilePage = readFileSync("src/app/profile/page.tsx", "utf8");
  const profileCard = readFileSync("src/components/profile-card.tsx", "utf8");
  const profileRoute = readFileSync("src/app/api/user/profile/route.ts", "utf8");
  const userProfile = readFileSync("src/lib/user-profile.ts", "utf8");
  assert.match(profilePage, /个人设置/);
  assert.match(profilePage, /手机号仍作为登录的唯一标识/);
  assert.match(profileCard, /用户名/);
  assert.match(profileCard, /公司信息/);
  assert.match(profileCard, /确认新密码/);
  assert.match(profileRoute, /newPasswordConfirm/);
  assert.match(userProfile, /两次输入的新密码不一致/);
});

test("enterprise settings show built-in DeepSeek and StepPlan model routing", () => {
  const settingsTab = readFileSync("src/app/admin/enterprise/settings-tab.tsx", "utf8");
  const settingsRoute = readFileSync("src/app/api/admin/settings/route.ts", "utf8");
  assert.match(settingsTab, /系统内置模型路由/);
  assert.match(settingsTab, /DeepSeek V4 Pro/);
  assert.match(settingsTab, /StepPlan（Step 3\.7 Flash）/);
  assert.match(settingsTab, /自定义服务商 \/ App ID/);
  assert.match(settingsTab, /暂不可用/);
  assert.doesNotMatch(settingsTab, /GPT-4/);
  assert.doesNotMatch(settingsTab, /Claude 3\.5 Sonnet/);
  assert.match(settingsRoute, /getModelCandidateSummaries/);
});

test("plan exports use direct authenticated downloads and Feishu is disabled for phone login", () => {
  const workspace = readFileSync("src/components/designer-workspace.tsx", "utf8");
  assert.ok(workspace.includes("exports/${kind}"));
  assert.ok(!workspace.includes("exports/link"));
  assert.match(workspace, /飞书导出暂不可用/);
  assert.doesNotMatch(workspace, /exportFeishu/);
});

test("blueprint exports use direct authenticated markdown and pdf downloads", () => {
  const markdownRoute = readFileSync("src/app/api/sessions/[sessionId]/blueprint/exports/markdown/route.ts", "utf8");
  const pdfRoute = readFileSync("src/app/api/sessions/[sessionId]/blueprint/exports/pdf/route.ts", "utf8");
  const exportLibrary = readFileSync("src/lib/blueprint-export.ts", "utf8");

  assert.match(markdownRoute, /authorizeExport\(request, sessionId, "markdown"\)/);
  assert.match(markdownRoute, /blueprintToMarkdown\(session\.outputs\.blueprint\)/);
  assert.match(markdownRoute, /organization-blueprint-\$\{session\.id\.slice\(0, 8\)\}\.md/);
  assert.match(markdownRoute, /text\/markdown/);
  assert.match(pdfRoute, /authorizeExport\(request, sessionId, "pdf"\)/);
  assert.match(pdfRoute, /renderBlueprintPdf\(session\.outputs\.blueprint\)/);
  assert.match(pdfRoute, /organization-blueprint-\$\{session\.id\.slice\(0, 8\)\}\.pdf/);
  assert.match(pdfRoute, /application\/pdf/);
  assert.match(exportLibrary, /AI 生成洞察/);
  assert.match(exportLibrary, /推荐火种回路/);
  assert.match(exportLibrary, /候选火种回路/);
  assert.match(exportLibrary, /## 五级阶梯/);
  assert.match(exportLibrary, /stageLadderLines/);
  assert.match(exportLibrary, /当前阶段/);
});

test("maturity diagnosis appears after the collaboration control loop", () => {
  const workspace = readFileSync("src/components/designer-workspace.tsx", "utf8");
  const loopGraphIndex = workspace.indexOf("<ToBeLoopCellsPanel");
  const maturityIndex = workspace.indexOf("{enrichedPlan.maturityMapping ? <MaturityAssessmentPanel");
  assert.notEqual(loopGraphIndex, -1);
  assert.notEqual(maturityIndex, -1);
  assert.ok(loopGraphIndex < maturityIndex);
});

test("uncalibrated implementation placeholder is not shown as a primary plan section", () => {
  const workspace = readFileSync("src/components/designer-workspace.tsx", "utf8");
  assert.doesNotMatch(workspace, /落地信息待校准/);
  assert.doesNotMatch(workspace, /当前版本先不把这些内容作为主方案展示/);
});

test("result plan keeps lightweight learner guidance close to actions", () => {
  const workspace = readFileSync("src/components/designer-workspace.tsx", "utf8");
  const maturityPanel = readFileSync("src/components/maturity-assessment-panel.tsx", "utf8");
  const markdown = readFileSync("src/lib/markdown.ts", "utf8");
  assert.match(workspace, /优化优先级清单/);
  assert.match(workspace, /推荐优先行动/);
  assert.match(workspace, /下一步任务/);
  assert.match(workspace, /亮点是什么/);
  assert.match(workspace, /短板是什么/);
  assert.match(workspace, /用来判断后面的设计有没有跑偏/);
  assert.match(workspace, /哪些步骤适合 AI 稳定帮忙/);
  assert.match(workspace, /每一步主要由谁处理/);
  assert.match(workspace, /回到输入重新编辑/);
  assert.match(workspace, /修改业务回路沙盘/);
  assert.match(workspace, /高级：只针对报告局部优化/);
  assert.match(maturityPanel, /不是考试评分/);
  assert.match(maturityPanel, /这条回路能不能先跑/);
  assert.match(maturityPanel, /最容易出问题/);
  assert.match(maturityPanel, /具体行动路线/);
  assert.doesNotMatch(workspace, /品牌部视频制作示例/);
  assert.match(workspace, /费劲的地方/);
  assert.doesNotMatch(workspace, /当前摩擦/);
  assert.match(workspace, /不能为了效率牺牲的底线/);
  assert.match(markdown, /## 优先阅读/);
  assert.match(markdown, /这条回路能不能先跑/);
  assert.match(markdown, /具体行动路线/);
  assert.doesNotMatch(maturityPanel, /L1|L2|L3|L4|L5|综合层级/);
  assert.doesNotMatch(markdown, /L1|L2|L3|L4|L5|综合层级/);
  assert.doesNotMatch(workspace, /主 actor|Agent 主导 \+ HITL|HITL 触发/);
  assert.doesNotMatch(markdown, /主 actor|Agent 主导 \+ HITL/);
});

test("workflow sandbox supports local insertion and generated plans can reopen inputs", () => {
  const workspace = readFileSync("src/components/designer-workspace.tsx", "utf8");
  const route = readFileSync("src/app/api/sessions/[sessionId]/route.ts", "utf8");
  const sessions = readFileSync("src/lib/sessions.ts", "utf8");
  assert.match(workspace, /onInsertCellAfter/);
  assert.match(workspace, /在下方增加一步/);
  assert.match(workspace, /insertCellAfter/);
  assert.match(route, /body\.action === "reopen"/);
  assert.match(route, /reopenSessionForEditing/);
  assert.match(sessions, /export async function reopenSessionForEditing/);
  assert.match(sessions, /currentStep: stepIndex/);
  assert.match(sessions, /currentPlan: _currentPlan/);
  assert.match(sessions, /上一版方案已保留/);
});

test("generation wait state is visible and live dossier can expand full input", () => {
  const workspace = readFileSync("src/components/designer-workspace.tsx", "utf8");
  const generateRoute = readFileSync("src/app/api/sessions/[sessionId]/generate/route.ts", "utf8");
  const sessionRoute = readFileSync("src/app/api/sessions/[sessionId]/route.ts", "utf8");
  const generationJobs = readFileSync("src/lib/generation-jobs.ts", "utf8");
  const workerRoute = readFileSync("src/app/api/generation-jobs/run/route.ts", "utf8");
  const healthRoute = readFileSync("src/app/api/health/route.ts", "utf8");
  const migration = readFileSync("supabase/migrations/202606210001_loop_designer_generation_jobs.sql", "utf8");
  const workerScript = readFileSync("scripts/generation-worker.mjs", "utf8");
  const printQueueMigration = readFileSync("scripts/print-generation-queue-migration.mjs", "utf8");
  const applyQueueMigration = readFileSync("scripts/apply-generation-queue-migration.mjs", "utf8");
  const verifyQueue = readFileSync("scripts/verify-generation-queue.mjs", "utf8");
  const queueRunbook = readFileSync("docs/generation-queue-runbook.md", "utf8");
  const ecosystem = readFileSync("ecosystem.config.cjs", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  const sessions = readFileSync("src/lib/sessions.ts", "utf8");
  const saveAnswerStart = sessions.indexOf("export async function saveAnswer");
  const saveAnswerEnd = sessions.indexOf("export async function updateSession");
  const saveAnswer = sessions.slice(saveAnswerStart, saveAnswerEnd);
  assert.match(workspace, /GenerationProgressPanel/);
  assert.match(workspace, /正在后台生成完整方案/);
  assert.match(workspace, /稍后回到本页刷新查看结果/);
  assert.match(workspace, /高峰时会排队生成/);
  assert.match(workspace, /generationJob/);
  assert.match(workspace, /Worker 正在生成方案/);
  assert.match(generateRoute, /session\.status === "generating"/);
  assert.match(generateRoute, /enqueuePlanGenerationJob/);
  assert.doesNotMatch(generateRoute, /generatePlanWithModel/);
  assert.doesNotMatch(generateRoute, /generateAndPersistPlan/);
  assert.match(workspace, /pollPlanStatus/);
  assert.match(workspace, /async: true/);
  assert.match(generateRoute, /status: 202/);
  assert.match(sessionRoute, /export async function GET/);
  assert.match(sessionRoute, /getLatestPlanGenerationJob/);
  assert.match(generationJobs, /loop_designer_generation_jobs/);
  assert.match(generationJobs, /claimNextPlanGenerationJob/);
  assert.match(generationJobs, /executePlanGenerationJob/);
  assert.match(generationJobs, /generatePlanWithModel/);
  assert.match(generationJobs, /checkGenerationQueueSchema/);
  assert.match(workerRoute, /runPlanGenerationJobBatch/);
  assert.match(workerRoute, /LOOP_GENERATION_WORKER_SECRET/);
  assert.match(healthRoute, /generationQueue/);
  assert.match(healthRoute, /checkGenerationQueueSchema/);
  assert.match(migration, /create table if not exists public\.loop_designer_generation_jobs/);
  assert.match(migration, /loop_designer_generation_jobs_one_active_per_session_idx/);
  assert.match(workerScript, /LOOP_GENERATION_WORKER_URL/);
  assert.match(printQueueMigration, /GENERATION_QUEUE_MIGRATIONS/);
  assert.match(applyQueueMigration, /buildGenerationQueueMigrationBundle/);
  assert.match(applyQueueMigration, /GENERATION_QUEUE_DATABASE_URL \|\| process\.env\.LOOP_OS_DATABASE_URL/);
  assert.match(applyQueueMigration, /does not match NEXT_PUBLIC_SUPABASE_URL project/);
  assert.match(verifyQueue, /loop_designer_generation_jobs/);
  assert.match(verifyQueue, /one active generation job per session/);
  assert.match(queueRunbook, /node scripts\/verify-generation-queue\.mjs --write-probe/);
  assert.match(ecosystem, /carbon-silicon-loop-designer-worker/);
  assert.match(packageJson, /worker:generation/);
  assert.match(packageJson, /db:generation-queue:verify/);
  assert.match(workspace, /LiveDossier/);
  assert.match(workspace, /INPUT SUMMARY/);
  assert.match(workspace, /展开完整输入/);
  assert.match(workspace, /whitespace-pre-wrap/);
  assert.doesNotMatch(workspace, /line-clamp-5/);
  assert.match(workspace, /userMessageForChat/);
  assert.match(workspace, /dossierPreview/);
  assert.match(saveAnswer, /summarizeAnswerForChat/);
  assert.doesNotMatch(saveAnswer, /content: answer/);
});
