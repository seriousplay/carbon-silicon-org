/**
 * 邮件通知子系统（基于 Resend）
 *
 * 基于 review/v1 Sprint 2：邮件通知
 * 基于 docs/07 技术架构：站内+邮件双渠道
 *
 * 降级：未配置 RESEND_API_KEY 时跳过邮件发送，仅站内通知
 */
import { Resend } from "resend";

let cachedClient: Resend | null = null;

/** 获取 Resend 客户端（单例） */
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!cachedClient) {
    cachedClient = new Resend(process.env.RESEND_API_KEY);
  }
  return cachedClient;
}

/** 发送邮件（降级：未配置则跳过） */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const client = getClient();
  if (!client) return false; // 降级：未配置 Resend

  try {
    const { error } = await client.emails.send({
      from: process.env.MAIL_FROM ?? "回路OS <noreply@loopos.app>",
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.error("邮件发送失败:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("邮件发送异常:", e);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendInvitationEmail(params: {
  to: string;
  organizationName: string;
  invitationUrl: string;
}): Promise<boolean> {
  const organizationName = escapeHtml(params.organizationName);
  const invitationUrl = escapeHtml(params.invitationUrl);
  return sendEmail({
    to: params.to,
    subject: `邀请你加入 ${params.organizationName}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>加入 ${organizationName}</h2>
        <p>你收到了一份组织邀请。请通过下面的专属链接接受邀请。</p>
        <a href="${invitationUrl}" style="display: inline-block; background: #4a7c59; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px;">
          查看邀请
        </a>
      </div>
    `,
  });
}

/** 发送阻塞点超时通知邮件 */
export async function sendBlockerOverdueEmail(params: {
  to: string;
  recipientName: string;
  blockerDescription: string;
  circleName: string;
  hoursOverdue: number;
  appUrl: string;
}): Promise<boolean> {
  return sendEmail({
    to: params.to,
    subject: `阻塞点超时 ${params.hoursOverdue}h：${params.blockerDescription.slice(0, 30)}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #b85450;">阻塞点需要你的关注</h2>
        <p>${params.recipientName}，</p>
        <p>你在「${params.circleName}」回路负责的阻塞点已超过 ${params.hoursOverdue}h 无更新：</p>
        <blockquote style="border-left: 3px solid #c97b5e; padding-left: 12px; margin: 16px 0; color: #555;">
          ${params.blockerDescription}
        </blockquote>
        <p>请更新状态，或标记阻塞原因。</p>
        <a href="${params.appUrl}/app/tracker" style="display: inline-block; background: #4a7c59; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px;">
          查看追踪看板
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">回路OS · 让组织学会自我生长</p>
      </div>
    `,
  });
}
