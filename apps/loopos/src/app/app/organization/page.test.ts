import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const organizationPageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const organizationSubnavSource = readFileSync(new URL("./organization-subnav.tsx", import.meta.url), "utf8");
const activationFormSource = readFileSync(new URL("./activation-form.tsx", import.meta.url), "utf8");
const meetingNewPageSource = readFileSync(new URL("../meetings/new/page.tsx", import.meta.url), "utf8");
const setupActionsSource = readFileSync(new URL("../setup/actions.ts", import.meta.url), "utf8");
const organizationProfileFormSource = readFileSync(new URL("../setup/organization-profile-form.tsx", import.meta.url), "utf8");
const organizationProfileActionsSource = readFileSync(new URL("../setup/organization-profile-actions.ts", import.meta.url), "utf8");
const setupWorkspaceReadModelSource = readFileSync(
  new URL("../../../lib/organization-setup/setup-workspace-read-model.ts", import.meta.url),
  "utf8",
);

test("organization entry renders the locked seven-step setup surface", () => {
  assert.match(organizationPageSource, /getSetupWorkspaceReadModel/);
  assert.match(organizationPageSource, /组织设置工作台/);
  for (const label of [
    "组织身份",
    "组织结构",
    "组织目标",
    "角色定义",
    "成员邀请",
    "角色任命",
    "系统配置",
  ]) {
    assert.match(setupWorkspaceReadModelSource, new RegExp(label));
  }
  assert.match(setupWorkspaceReadModelSource, /SetupWorkspaceStepKey/);
  assert.match(setupWorkspaceReadModelSource, /readyToActivate/);
  assert.match(organizationPageSource, /lifecycleStatus/);
  assert.match(organizationPageSource, /设置模式/);
  assert.match(organizationPageSource, /最低准备度/);
  assert.match(organizationPageSource, /<ActivationForm disabled=\{!workspace\.readyToActivate\}/);
  assert.doesNotMatch(organizationPageSource, /redirect\(/);
});

test("active organization entry renders an overview before setup-only content", () => {
  assert.match(organizationPageSource, /if \(active\)/);
  assert.match(organizationPageSource, /OrganizationSubnav active="overview"/);
  assert.match(organizationPageSource, /组织已启用。这里是日常组织运营入口，不再显示初始设置工作台。/);
  assert.match(organizationPageSource, /activeCards/);
  assert.match(organizationSubnavSource, /\/app\/organization/);
  assert.doesNotMatch(organizationSubnavSource, /description:/);
});

test("organization entry owns editable setup content instead of only linking away", () => {
  assert.match(organizationPageSource, /OrganizationProfileForm/);
  assert.match(organizationPageSource, /purpose=\{workspace\.organization\.purpose \?\? ""\}/);
  assert.match(organizationPageSource, /TerminologyForm/);
  assert.match(organizationPageSource, /GovernanceRulesForm/);
  assert.match(organizationPageSource, /ModelSettingsForm/);
  assert.match(organizationPageSource, /InitForm/);
  assert.match(organizationPageSource, /allTemplates\.map/);
  assert.match(organizationPageSource, /组织结构初始化已关闭/);
  assert.match(organizationPageSource, /初始化不可重新进入/);
  assert.match(organizationProfileFormSource, /name="organizationPurpose"/);
  assert.match(organizationProfileActionsSource, /formData\.get\("organizationPurpose"\)/);
  assert.match(organizationProfileActionsSource, /data: \{ name, purpose \}/);
  assert.match(organizationProfileActionsSource, /revalidatePath\("\/app\/organization"\)/);
  assert.match(setupActionsSource, /revalidatePath\("\/app\/organization"\)/);
});

test("organization entry exposes actionable goals people and assignment setup panels", () => {
  for (const label of [
    "03 组织目标",
    "04 角色定义",
    "05 成员邀请",
    "06 角色任命",
    "打开目标工作区",
    "查看组织结构和角色",
    "管理成员邀请",
    "打开角色市场",
  ]) {
    assert.match(organizationPageSource, new RegExp(label));
  }
  assert.match(organizationPageSource, /workspace\.counts\.activeGoals/);
  assert.match(organizationPageSource, /workspace\.counts\.heldInvitations/);
  assert.match(organizationPageSource, /workspace\.counts\.assignedLeadRoles/);
});

test("organization entry exposes prioritized readiness gap guidance", () => {
  assert.match(organizationPageSource, /下一步准备度/);
  assert.match(organizationPageSource, /readinessActions/);
  assert.match(organizationPageSource, /workspace\.readiness\.some/);
  for (const action of [
    "填写组织名称和目的",
    "初始化或检查主结构",
    "为关键角色完成真人任命",
    "建立目标周期并提交主目标",
    "配置组织大脑模型",
  ]) {
    assert.match(organizationPageSource, new RegExp(action));
  }
  assert.match(organizationPageSource, /id="organization-identity"/);
  assert.match(organizationPageSource, /id="organization-structure"/);
  assert.match(organizationPageSource, /id="system-configuration"/);
});

test("organization setup navigation keeps editable setup steps inside organization", () => {
  assert.match(setupWorkspaceReadModelSource, /href: "\/app\/organization#organization-identity"/);
  assert.match(setupWorkspaceReadModelSource, /href: "\/app\/organization#system-configuration"/);
  assert.doesNotMatch(setupWorkspaceReadModelSource, /href: "\/app\/setup"/);
});

test("activation form calls the accepted server action and keeps activation explicit", () => {
  assert.match(activationFormSource, /useActionState<ActivationState, FormData>/);
  assert.match(activationFormSource, /activateOrganizationAction/);
  assert.match(activationFormSource, /确认启用组织/);
  assert.match(setupActionsSource, /activateOrganizationAction/);
  assert.match(setupActionsSource, /activateOrganization\(\{/);
  assert.match(setupActionsSource, /createPrismaOrganizationActivationDependencies/);
});

test("new meeting page shows lifecycle locked state before the meeting form", () => {
  assert.match(meetingNewPageSource, /organization\?\.lifecycleStatus !== "ACTIVE"/);
  assert.match(meetingNewPageSource, /组织尚未启用，暂不能发起会议/);
  assert.match(meetingNewPageSource, /href="\/app\/organization"/);
  assert.match(meetingNewPageSource, /<NewMeetingForm/);
});
