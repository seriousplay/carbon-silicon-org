import "server-only";

import puppeteer from "puppeteer-core";
import { resolveChromiumExecutablePath } from "./chromium";
import type { LoopPlan } from "./plan-schema";
import { planToMarkdown } from "./markdown";
import { renderOrganizationPdfHtml, renderOrganizationSvg } from "./organization-export";
import { renderMarkdownForPdfHtml } from "./pdf-markdown";

export async function renderPlanPdf(plan: LoopPlan) {
  const executablePath = resolveChromiumExecutablePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const markdown = planToMarkdown(plan);
    const organizationSvg = renderOrganizationSvg(plan.organizationMap);
    const organizationDetails = renderOrganizationPdfHtml(plan.organizationMap);
    const reportBody = renderReportBody(markdown, organizationSvg, organizationDetails);
    await page.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:17mm 15mm 18mm}*{box-sizing:border-box}body{font-family:"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif;color:#17211e;line-height:1.62;margin:0;background:#fff}
      main{font-size:11px}.report-flow h1{font-size:24px;line-height:1.24;color:#0d6b56;margin:0 0 12px;break-after:avoid}.report-flow h2{font-size:18px;line-height:1.3;color:#0d6b56;margin:22px 0 9px;padding-bottom:5px;border-bottom:1px solid #dce5e0;break-after:avoid}.report-flow h3{font-size:13px;color:#27443a;margin:16px 0 7px;break-after:avoid}.report-flow h4{font-size:11px;color:#52615a;margin:12px 0 6px;break-after:avoid}
      .report-flow p{margin:0 0 8px}.report-flow blockquote{margin:0 0 14px;padding:10px 12px;border-left:4px solid #0d6b56;background:#edf5f1;color:#33443d;font-size:11px}.report-list{margin:0 0 10px 0;padding:0;list-style:none}.report-list li{position:relative;margin:0 0 4px;padding-left:12px}.report-list li::before{content:"";position:absolute;left:0;top:.72em;width:4px;height:4px;border-radius:50%;background:#0d6b56}.report-flow strong{font-weight:700;color:#17211e}.report-flow code{font-family:"SFMono-Regular",Consolas,monospace;background:#f3f6f4;border:1px solid #dce5e0;padding:0 3px}
      .table-wrap{margin:9px 0 16px;break-inside:auto;page-break-inside:auto}.table-wrap table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.7px;line-height:1.42}.table-wrap.cols-6 table,.table-wrap.cols-7 table,.table-wrap.cols-8 table{font-size:6.8px;line-height:1.36}.table-wrap th,.table-wrap td{border:1px solid #dce5e0;padding:4px 5px;vertical-align:top;word-break:break-word;overflow-wrap:anywhere}.table-wrap th{background:#edf5f1;color:#174f41;font-weight:700}.table-wrap tr:nth-child(even) td{background:#fafcfb}
      .org-map{margin:18px 0 26px;break-inside:avoid}.org-map h2{font-size:20px;color:#0d6b56;margin:0 0 10px}.org-map p{font-size:11px;color:#52615a;margin:0 0 12px}
      .org-detail h2{font-size:20px;color:#0d6b56;margin:24px 0 10px}.role-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .role-card{border:1px solid #dce5e0;border-top:3px solid;padding:12px;break-inside:avoid}.role-card h3{font-size:15px;margin:3px 0}.role-card p{font-size:10px;color:#52615a}
      .role-card div{font-size:9px;border-top:1px solid #edf1ef;padding-top:4px;margin-top:4px}.role-card b{display:inline-block;width:58px;color:#66736d}
      .org-detail table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.6px;line-height:1.4;margin:8px 0 16px;break-inside:auto}.org-detail th,.org-detail td{border:1px solid #dce5e0;padding:4px 5px;vertical-align:top;word-break:break-word;overflow-wrap:anywhere}.org-detail th{background:#edf5f1;color:#174f41;font-weight:700}.org-detail tr:nth-child(even) td{background:#fafcfb}
      footer{margin-top:32px;color:#667;font-size:9px}
    </style></head><body>${reportBody}<footer>碳硅组织设计工作室生成</footer></body></html>`, { waitUntil: "load" });
    return Buffer.from(await page.pdf({ format: "A4", printBackground: true }));
  } finally {
    await browser.close();
  }
}

function renderReportBody(markdown: string, organizationSvg: string, organizationDetails: string) {
  if (!organizationSvg) return renderMain(markdown);
  const topologyHeading = "## 人机协作拓扑图";
  const headingIndex = markdown.indexOf(topologyHeading);
  if (headingIndex === -1) {
    return `${renderMain(markdown)}${renderTopologySection(organizationSvg, organizationDetails)}`;
  }
  const before = markdown.slice(0, headingIndex).trimEnd();
  const after = markdown.slice(headingIndex + topologyHeading.length).trimStart();
  return `${before ? renderMain(before) : ""}${renderTopologySection(organizationSvg, organizationDetails)}${after ? renderMain(after) : ""}`;
}

function renderTopologySection(organizationSvg: string, organizationDetails: string) {
  return `<section class="org-map"><h2>人机协作拓扑图</h2><p>按人、AI、系统查看信息、决策和治理分工。</p>${organizationSvg}</section>${organizationDetails}`;
}

function renderMain(markdown: string) {
  return `<main class="report-flow">${renderMarkdownForPdfHtml(markdown)}</main>`;
}
