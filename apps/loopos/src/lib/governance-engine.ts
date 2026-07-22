/**
 * 提案采纳引擎
 *
 * 治理决策自动落地到回路结构的核心。
 * 采纳提案时，根据类型自动执行结构修改 + 审计 + 决策记录，全部原子化。
 *
 * 基于 docs/11-会议治理流程设计.md 第四节
 */
import { prisma } from "@/lib/db";

type ProposedChange = {
  // 角色相关
  name?: string;
  purpose?: string;
  domain?: string;
  accountabilities?: string;
  category?: string;
  circleId?: string;
  // 回路相关
  number?: string;
  type?: string;
  parentId?: string;
  // 归属变更
  homeCircleId?: string;
};

/**
 * 采纳治理提案，自动执行结构修改
 *
 * 在一个事务里完成：
 * 1. 执行结构修改（角色/回路 CRUD）
 * 2. 创建 DecisionRecord（决策记录）
 * 3. 创建 ChangeLog（变更审计）
 * 4. 更新提案状态为 ADOPTED
 * 5. 更新张力状态为 RESOLVED
 */
export async function adoptProposal(params: {
  proposalId: string;
  organizationId: string;
  decisionMakerId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { proposalId, organizationId, decisionMakerId } = params;

  const proposal = await prisma.governanceProposal.findFirst({
    where: { id: proposalId, organizationId },
  });

  if (!proposal) return { ok: false, error: "提案不存在" };
  if (proposal.status !== "PROPOSED") return { ok: false, error: "提案已处理" };

  const change = JSON.parse(proposal.proposedChange) as ProposedChange;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. 执行结构修改
      let changeType = "";
      let objectDesc = "";
      let beforeValue = "";
      let afterValue = "";

      switch (proposal.type) {
        case "ROLE_CREATED": {
          changeType = "ROLE_CREATED";
          objectDesc = `新建角色: ${change.name}`;
          beforeValue = "无";
          afterValue = change.name ?? "";
          await tx.roleDef.create({
            data: {
              organizationId,
              name: change.name ?? "未命名角色",
              purpose: change.purpose ?? "",
              domain: change.domain,
              accountabilities: change.accountabilities ?? "",
              circleId: change.circleId!,
              category: (change.category as never) ?? "EXPERT",
              ownershipType: "HOME",
            },
          });
          break;
        }

        case "ROLE_MODIFIED": {
          changeType = "ROLE_MODIFIED";
          const oldRole = await tx.roleDef.findUnique({
            where: { id: proposal.targetId! },
          });
          objectDesc = `修改角色: ${oldRole?.name ?? proposal.targetId}`;
          beforeValue = JSON.stringify({
            name: oldRole?.name,
            purpose: oldRole?.purpose,
            domain: oldRole?.domain,
            accountabilities: oldRole?.accountabilities,
          });
          afterValue = JSON.stringify(change);
          await tx.roleDef.update({
            where: { id: proposal.targetId! },
            data: {
              ...(change.name && { name: change.name }),
              ...(change.purpose && { purpose: change.purpose }),
              ...(change.domain !== undefined && { domain: change.domain }),
              ...(change.accountabilities && { accountabilities: change.accountabilities }),
            },
          });
          break;
        }

        case "ROLE_ARCHIVED": {
          changeType = "ROLE_ARCHIVED";
          const oldRole = await tx.roleDef.findUnique({
            where: { id: proposal.targetId! },
          });
          objectDesc = `废弃角色: ${oldRole?.name ?? proposal.targetId}`;
          beforeValue = "ACTIVE";
          afterValue = "ARCHIVED";
          await tx.roleDef.update({
            where: { id: proposal.targetId! },
            data: { status: "ARCHIVED" },
          });
          break;
        }

        case "CIRCLE_CREATED": {
          changeType = "CIRCLE_CREATED";
          objectDesc = `新建回路: ${change.name}`;
          beforeValue = "无";
          afterValue = change.name ?? "";
          await tx.circle.create({
            data: {
              organizationId,
              name: change.name ?? "未命名回路",
              number: (change.number as never) ?? "CUSTOM",
              type: (change.type as never) ?? "PRODUCTION",
              purpose: change.purpose ?? "",
              domain: change.domain,
              parentId: change.parentId,
            },
          });
          break;
        }

        case "CIRCLE_MODIFIED": {
          changeType = "CIRCLE_MODIFIED";
          const oldCircle = await tx.circle.findUnique({
            where: { id: proposal.targetId! },
          });
          objectDesc = `修改回路: ${oldCircle?.name ?? proposal.targetId}`;
          beforeValue = JSON.stringify({
            name: oldCircle?.name,
            purpose: oldCircle?.purpose,
          });
          afterValue = JSON.stringify(change);
          await tx.circle.update({
            where: { id: proposal.targetId! },
            data: {
              ...(change.name && { name: change.name }),
              ...(change.purpose && { purpose: change.purpose }),
              ...(change.domain !== undefined && { domain: change.domain }),
            },
          });
          break;
        }

        case "HOME_CHANGE": {
          changeType = "HOME_CHANGE";
          const oldPerson = await tx.person.findUnique({
            where: { id: proposal.targetId! },
            include: { homeCircle: { select: { name: true } } },
          });
          const newCircle = await tx.circle.findUnique({
            where: { id: change.homeCircleId! },
            select: { name: true },
          });
          objectDesc = `${oldPerson?.name} 的归属变更`;
          beforeValue = oldPerson?.homeCircle.name ?? "未知";
          afterValue = newCircle?.name ?? change.homeCircleId ?? "";
          await tx.person.update({
            where: { id: proposal.targetId! },
            data: { homeCircleId: change.homeCircleId! },
          });
          break;
        }

        default:
          throw new Error(`未知提案类型: ${proposal.type}`);
      }

      // 2. 创建决策记录
      const decision = await tx.decisionRecord.create({
        data: {
          organizationId,
          title: objectDesc,
          type: mapProposalToDecisionType(proposal.type),
          content: afterValue,
          rationale: proposal.rationale,
          decisionMakerId,
          meetingId: proposal.meetingId,
          effectiveAt: new Date(),
        },
      });

      // 3. 创建变更审计
      await tx.changeLog.create({
        data: {
          organizationId,
          type: changeType as never,
          objectDesc,
          beforeValue,
          afterValue,
          impactAssessment: `通过治理提案采纳（${proposal.rationale}）`,
          effectiveAt: new Date(),
          initiatorId: decisionMakerId,
          decisionId: decision.id,
        },
      });

      // 4. 更新提案状态
      await tx.governanceProposal.update({
        where: { id: proposalId },
        data: {
          status: "ADOPTED",
          adoptedAt: new Date(),
          decisionId: decision.id,
        },
      });

      // 5. 更新张力状态
      await tx.tension.update({
        where: { id: proposal.tensionId },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });
    });

    return { ok: true };
  } catch (e) {
    console.error("采纳提案失败:", e);
    return { ok: false, error: "采纳失败，结构修改未执行" };
  }
}

function mapProposalToDecisionType(
  proposalType: string
): "ROLE_CHANGE" | "STRATEGY_CHANGE" | "CIRCLE_STRUCTURE_CHANGE" | "CONFLICT_ADJUDICATION" {
  switch (proposalType) {
    case "ROLE_CREATED":
    case "ROLE_MODIFIED":
    case "ROLE_ARCHIVED":
      return "ROLE_CHANGE";
    case "CIRCLE_CREATED":
    case "CIRCLE_MODIFIED":
      return "CIRCLE_STRUCTURE_CHANGE";
    case "HOME_CHANGE":
      return "CIRCLE_STRUCTURE_CHANGE";
    default:
      return "STRATEGY_CHANGE";
  }
}
