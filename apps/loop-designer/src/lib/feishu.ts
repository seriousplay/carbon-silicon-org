import "server-only";

import type { LoopPlan } from "./plan-schema";
import { planToMarkdown } from "./markdown";
import { buildFeishuTableDescendants, parseMarkdownForFeishu } from "./feishu-document";

type FeishuResponse<T> = { code: number; msg: string; data?: T };

export async function exportPlanToFeishu(plan: LoopPlan, userOpenId: string) {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  const folderToken = process.env.FEISHU_EXPORT_FOLDER_TOKEN;
  if (!appId || !appSecret) throw new Error("飞书导出尚未配置");

  const tokenResponse = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const tokenPayload = (await tokenResponse.json()) as FeishuResponse<{ tenant_access_token?: string }> & { tenant_access_token?: string };
  const token = tokenPayload.tenant_access_token ?? tokenPayload.data?.tenant_access_token;
  if (!tokenResponse.ok || !token) throw new Error(`获取飞书访问令牌失败：${tokenPayload.msg || tokenResponse.status}`);

  const createResponse = await feishuFetch<{
    document: { document_id: string; title: string };
  }>("https://open.feishu.cn/open-apis/docx/v1/documents", token, {
    method: "POST",
    body: JSON.stringify({
      ...(folderToken ? { folder_token: folderToken } : {}),
      title: plan.title.slice(0, 200),
    }),
  });
  const documentId = createResponse.document.document_id;
  const items = parseMarkdownForFeishu(planToMarkdown(plan));
  let textBuffer: string[] = [];
  let tableIndex = 0;
  const flushText = async () => {
    if (!textBuffer.length) return;
    const children = textBuffer.map(toTextBlock);
    await feishuFetch(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/children`,
      token,
      { method: "POST", body: JSON.stringify({ index: -1, children }) },
    );
    textBuffer = [];
    await pauseForDocumentRateLimit();
  };

  for (const item of items) {
    if (item.type === "text") {
      textBuffer.push(item.content);
      if (textBuffer.length === 40) await flushText();
      continue;
    }

    await flushText();
    const nestedBlocks = buildFeishuTableDescendants(item.rows, `table_${tableIndex}`);
    await feishuFetch(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/descendant`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ index: -1, ...nestedBlocks }),
      },
    );
    tableIndex += 1;
    await pauseForDocumentRateLimit();
  }
  await flushText();

  await feishuFetch(
    `https://open.feishu.cn/open-apis/drive/v1/permissions/${documentId}/members?type=docx`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        member_type: "openid",
        member_id: userOpenId,
        perm: "edit",
      }),
    },
  );
  return { documentId, url: `https://feishu.cn/docx/${documentId}` };
}

function toTextBlock(content: string) {
  const heading = content.match(/^(#{1,3})\s+(.+)$/);
  const bullet = content.match(/^[-*]\s+(.+)$/);
  const blockType = heading ? 2 + heading[1].length : bullet ? 12 : 2;
  const key = heading ? `heading${heading[1].length}` : bullet ? "bullet" : "text";
  return {
    block_type: blockType,
    [key]: {
      elements: [{ text_run: { content: heading?.[2] ?? bullet?.[1] ?? content, text_element_style: {} } }],
      style: {},
    },
  };
}

function pauseForDocumentRateLimit() {
  return new Promise((resolve) => setTimeout(resolve, 380));
}

async function feishuFetch<T>(url: string, token: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json()) as FeishuResponse<T>;
  if (!response.ok || payload.code !== 0 || !payload.data) {
    throw new Error(`飞书 API 失败（${payload.code || response.status}）：${payload.msg || response.status}`);
  }
  return payload.data;
}
