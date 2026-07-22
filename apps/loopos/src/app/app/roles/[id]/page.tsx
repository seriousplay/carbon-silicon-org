import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/shared/status-badge";
import { roleCategoryMap, roleOwnershipMap } from "@/lib/constants";
import {
  approveRoleAiCoAssigneePolicy,
  revokeRoleAiCoAssigneePolicy,
  saveRoleAiCoAssigneePolicy,
  submitRoleExitToGovernance,
  suspendRoleAiCoAssigneePolicy,
} from "./actions";
import { getOrganizationGovernanceConfig, organizationRoleCategoryLabel } from "@/lib/organization-governance-config";
import { AI_CAPABILITY_RISK_LEVELS, evaluateAiExecutionReadiness } from "@/lib/ai-coassignees/policy";

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();

  const [role, governanceConfig] = await Promise.all([prisma.roleDef.findFirst({
    where: { id, organizationId: orgId },
    include: {
      circle: { select: { id: true, name: true, purpose: true } },
      assignees: { select: { id: true, name: true } },
      actions: {
        where: { status: { notIn: ["RESOLVED", "REJECTED"] } },
        select: {
          id: true,
          title: true,
          status: true,
          deadline: true,
          actionContext: true,
          ownerId: true,
          owner: { select: { name: true } },
        },
        orderBy: { deadline: "asc" },
      },
      contract: { select: { id: true, name: true } },
      aiCoAssignmentPolicies: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          aiPersonId: true,
          accountableHumanPersonId: true,
          maxRiskLevel: true,
          status: true,
          approvedAt: true,
          suspendedAt: true,
          revokedAt: true,
          revocationReason: true,
          aiPerson: { select: { name: true, entityType: true } },
          accountableHuman: { select: { name: true, entityType: true } },
        },
      },
      assignmentHistory: { orderBy: { effectiveAt: "desc" }, take: 20, select: { id: true, eventType: true, effectiveAt: true, person: { select: { name: true } } } },
    },
  }), getOrganizationGovernanceConfig(orgId)]);

  if (!role) notFound();

  const catInfo = { ...roleCategoryMap[role.category], label: organizationRoleCategoryLabel(governanceConfig.profile, role.category) };
  const ownInfo = roleOwnershipMap[role.ownershipType];
  const isMine = role.assignees.some((a) => a.id === person?.id);
  const membership = person?.userId
    ? await prisma.membership.findFirst({
        where: { userId: person.userId, organizationId: orgId },
        select: { role: true },
      })
    : null;
  const isOrgAdmin = membership?.role === "ORG_ADMIN";
  const [aiPeople, humanPeople] = isOrgAdmin
    ? await Promise.all([
        prisma.person.findMany({
          where: { organizationId: orgId, entityType: "AGENT" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.person.findMany({
          where: { organizationId: orgId, entityType: "HUMAN" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];
  const [meetings, tensions] = isMine ? await Promise.all([
    prisma.meeting.findMany({ where: { organizationId: orgId, type: "GOVERNANCE", endedAt: null }, select: { id: true, title: true }, orderBy: { startedAt: "desc" }, take: 20 }),
    prisma.tension.findMany({ where: { organizationId: orgId, status: "OPEN", handlingMode: "GOVERNANCE" }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]) : [[], []];

  return (
    <div className="max-w-3xl mx-auto animate-fade-rise">
      <Link
        href={isMine ? "/app/me" : `/app/circles/${role.circle.id}`}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block"
      >
        ← {isMine ? "我的工作台" : role.circle.name}
      </Link>

      <div className="flex items-center gap-2 mb-3">
        <StatusBadge variant="growing" label={catInfo.label} />
        {role.ownershipType !== "HOME" && (
          <StatusBadge variant="seed" label={ownInfo.label} />
        )}
      </div>

      <h1 className="font-serif text-2xl font-medium mb-2">{role.name}</h1>
      <Link
        href={`/app/circles/${role.circle.id}`}
        className="text-sm text-moss hover:underline"
      >
        {role.circle.name}
      </Link>

      {/* Holacracy 三要素 */}
      <div className="rounded-card border border-border bg-card p-6 shadow-soft mt-6 mb-6">
        {/* Purpose */}
        <div className="mb-5">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            目的 <span className="font-mono normal-case">Purpose</span>
          </h2>
          <p className="font-serif text-lg italic leading-relaxed">{role.purpose}</p>
        </div>

        {/* Domain */}
        {role.domain && (
          <div className="mb-5">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              域 <span className="font-mono normal-case">Domain</span>
            </h2>
            <p className="text-sm leading-relaxed">{role.domain}</p>
            <p className="text-xs text-muted-foreground mt-1">
              这个角色排他控制的领域。其他角色涉足需经协商。
            </p>
          </div>
        )}

        {/* Accountabilities */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            持续承担 <span className="font-mono normal-case">Accountabilities</span>
          </h2>
          <ul className="space-y-2">
            {role.accountabilities.split("\n").filter(Boolean).map((acc, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="text-moss mt-0.5 shrink-0">·</span>
                <span className="text-sm leading-relaxed">{acc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 承担人 */}
      <div className="rounded-card border border-border bg-card p-5 shadow-soft mb-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          承担人 ({role.assignees.length})
        </h2>
        <div className="flex flex-wrap gap-3">
          {role.assignees.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-moss-pale text-moss flex items-center justify-center text-xs font-medium">
                {a.name.slice(0, 2)}
              </div>
              <span className="text-sm">{a.name}</span>
              {a.id === person?.id && (
                <span className="text-xs text-moss">（我）</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-border bg-card p-5 shadow-soft mb-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              AI 共同承担策略
            </h2>
            <p className="text-sm text-muted-foreground">
              AI 只能作为角色的共同承担者，并始终绑定一个人类责任人。
            </p>
          </div>
          <StatusBadge variant="seed" label={role.aiCoAssignmentPolicies.length > 0 ? "已配置" : "未配置"} />
        </div>

        {role.aiCoAssignmentPolicies.length > 0 ? (
          <div className="space-y-2">
            {role.aiCoAssignmentPolicies.map((policy) => {
              const readiness = evaluateAiExecutionReadiness({
                roleStatus: role.status,
                aiPersonEntityType: policy.aiPerson.entityType,
                accountableHumanEntityType: policy.accountableHuman.entityType,
                policyStatus: policy.status,
                maxRiskLevel: policy.maxRiskLevel,
              });
              return (
              <div key={policy.id} className="rounded-input border border-border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{policy.aiPerson.name}</span>
                  <span className="text-muted-foreground">共同承担，责任人</span>
                  <span className="font-medium">{policy.accountableHuman.name}</span>
                  <StatusBadge variant="growing" label={policy.maxRiskLevel} />
                  <StatusBadge variant="seed" label={policy.status} />
                  <StatusBadge variant={readiness.ready ? "growing" : "seed"} label={readiness.label} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  执行准备度：{readiness.code}。这只是未来执行前检查，不会触发 AI 自动执行。
                </p>
                {(policy.approvedAt || policy.suspendedAt || policy.revokedAt || policy.revocationReason) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {policy.approvedAt ? `批准 ${policy.approvedAt.toLocaleDateString("zh-CN")}` : null}
                    {policy.suspendedAt ? ` · 暂停 ${policy.suspendedAt.toLocaleDateString("zh-CN")}` : null}
                    {policy.revokedAt ? ` · 撤销 ${policy.revokedAt.toLocaleDateString("zh-CN")}` : null}
                    {policy.revocationReason ? ` · ${policy.revocationReason}` : null}
                  </p>
                )}
                {isOrgAdmin && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {policy.status === "PROPOSED" && (
                      <form action={approveRoleAiCoAssigneePolicy}>
                        <input type="hidden" name="policyId" value={policy.id} />
                        <input type="hidden" name="roleId" value={role.id} />
                        <button type="submit" className="h-8 rounded-input bg-primary px-3 text-xs text-primary-foreground">批准</button>
                      </form>
                    )}
                    {policy.status === "APPROVED" && (
                      <form action={suspendRoleAiCoAssigneePolicy} className="flex gap-2">
                        <input type="hidden" name="policyId" value={policy.id} />
                        <input type="hidden" name="roleId" value={role.id} />
                        <input name="reason" placeholder="暂停原因" className="h-8 w-36 border border-border bg-background px-2 text-xs" />
                        <button type="submit" className="h-8 rounded-input border border-border px-3 text-xs">暂停</button>
                      </form>
                    )}
                    {policy.status !== "REVOKED" && (
                      <form action={revokeRoleAiCoAssigneePolicy} className="flex gap-2">
                        <input type="hidden" name="policyId" value={policy.id} />
                        <input type="hidden" name="roleId" value={role.id} />
                        <input name="reason" placeholder="撤销原因" className="h-8 w-36 border border-border bg-background px-2 text-xs" />
                        <button type="submit" className="h-8 rounded-input border border-border px-3 text-xs">撤销</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">这个角色还没有 AI 共同承担策略。</p>
        )}

        {isOrgAdmin && (
          <form action={saveRoleAiCoAssigneePolicy} className="mt-4 grid gap-2 sm:grid-cols-4">
            <input type="hidden" name="roleId" value={role.id} />
            <select name="aiPersonId" required className="h-9 border border-border bg-background px-2 text-sm">
              <option value="">选择 AI 成员</option>
              {aiPeople.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
            <select name="accountableHumanPersonId" required className="h-9 border border-border bg-background px-2 text-sm">
              <option value="">选择责任人</option>
              {humanPeople.map((human) => (
                <option key={human.id} value={human.id}>{human.name}</option>
              ))}
            </select>
            <select name="maxRiskLevel" required defaultValue="L1" className="h-9 border border-border bg-background px-2 text-sm">
              {AI_CAPABILITY_RISK_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            <button
              type="submit"
              className="h-9 rounded-input bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
              disabled={aiPeople.length === 0 || humanPeople.length === 0}
            >
              保存提议
            </button>
          </form>
        )}
      </div>

      {isMine && role.assignees.length > 0 && (
        <div className="rounded-card border border-border bg-card p-5 shadow-soft mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">退出任职</h2>
          <p className="text-sm text-muted-foreground mb-3">退出必须由提出者提交张力，并经治理会议确认。</p>
          <form action={submitRoleExitToGovernance} className="grid gap-2 sm:grid-cols-3">
            <input type="hidden" name="roleId" value={role.id} />
            <select name="meetingId" required className="h-9 border border-border bg-background px-2 text-sm"><option value="">选择治理会</option>{meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}</select>
            <select name="tensionId" required className="h-9 border border-border bg-background px-2 text-sm"><option value="">选择来源张力</option>{tensions.map((tension) => <option key={tension.id} value={tension.id}>{tension.title}</option>)}</select>
            <button type="submit" className="h-9 rounded-input bg-primary px-3 text-sm text-primary-foreground">提交退出审核</button>
          </form>
        </div>
      )}

      {role.assignmentHistory.length > 0 && (
        <div className="rounded-card border border-border bg-card p-5 shadow-soft mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">任职历史</h2>
          <div className="space-y-2 text-sm">{role.assignmentHistory.map((event) => <div key={event.id} className="flex justify-between gap-3"><span>{event.person.name} · {event.eventType === "ASSIGNED" ? "开始承担" : "退出任职"}</span><time className="text-xs text-muted-foreground">{event.effectiveAt.toLocaleDateString("zh-CN")}</time></div>)}</div>
        </div>
      )}

      {/* 这个角色正在承担的行动 */}
      {role.actions.length > 0 && (
        <div className="rounded-card border border-border bg-card p-5 shadow-soft">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            进行中的行动 ({role.actions.length})
          </h2>
          <div className="space-y-2">
            {role.actions.map((a) => (
              <Link
                key={a.id}
                href={`/app/tracker/${a.id}`}
                className="block rounded-input border border-border p-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{a.title}</span>
                  {a.deadline && (
                    <span className="text-xs text-muted-foreground">
                      {a.deadline.toLocaleDateString("zh-CN")}
                    </span>
                  )}
                </div>
                {a.actionContext && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    ← {a.actionContext}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 跨回路契约 */}
      {role.contract && (
        <div className="rounded-card border border-needs-light/30 bg-needs-light-pale/20 p-4 mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-needs-light mb-1">
            跨回路契约
          </p>
          <p className="text-sm">
            这个角色是跨回路支援角色，需遵守契约：
            <Link href={`/app/interfaces`} className="text-moss hover:underline ml-1">
              {role.contract.name}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
