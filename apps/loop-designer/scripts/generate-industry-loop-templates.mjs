import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(__dirname, "../../../行业回路模板卡");
const outputFile = path.resolve(__dirname, "../src/lib/industry-loop-template-data.json");

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  const frontmatter = {};
  if (!match) return frontmatter;
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^([^:]+):\s*(.*)$/);
    if (!pair) continue;
    frontmatter[pair[1].trim()] = pair[2].trim().replace(/^"|"$/g, "");
  }
  return frontmatter;
}

function section(markdown, title) {
  const marker = `## ${title}`;
  const start = markdown.indexOf(marker);
  if (start < 0) return "";
  const bodyStart = start + marker.length;
  const next = markdown.indexOf("\n## ", bodyStart);
  return markdown.slice(bodyStart, next < 0 ? markdown.length : next).trim();
}

function cleanText(value) {
  return value
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstParagraph(value) {
  return cleanText(value)
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .find(Boolean) || "";
}

function parseStageMappings(markdown) {
  return section(markdown, "五阶段映射")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\|\s*\*\*/.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cleanText(cell));
      return { stage: cells[0], ai: cells[1], human: cells[2] };
    })
    .filter((item) => item.stage && item.ai && item.human);
}

function parseBoundary(markdown, heading) {
  const content = section(markdown, "适用边界");
  const start = content.indexOf(`### ${heading}`);
  if (start < 0) return "";
  const bodyStart = start + `### ${heading}`.length;
  const next = content.indexOf("\n### ", bodyStart);
  return firstParagraph(content.slice(bodyStart, next < 0 ? content.length : next));
}

function normalizeTitle(frontmatter, markdown) {
  const fromHeading = markdown.match(/^#\s+(.+)$/m)?.[1];
  return cleanText(fromHeading || frontmatter.title || "")
    .replace(/\s*行业回路模板卡$/, "")
    .trim();
}

const files = readdirSync(sourceDir)
  .filter((file) => /^\d+_.+\.md$/.test(file))
  .sort((a, b) => a.localeCompare(b, "zh-CN"));

const templates = files.map((file) => {
  const markdown = readFileSync(path.join(sourceDir, file), "utf8");
  const frontmatter = parseFrontmatter(markdown);
  const order = Number(file.match(/^(\d+)_/)?.[1] || 0);
  const title = normalizeTitle(frontmatter, markdown);
  return {
    id: file.replace(/\.md$/, ""),
    order,
    title,
    industry: frontmatter["所属行业"] || "未分类",
    pathType: frontmatter["路径类型"] || "",
    marginalEffectRating: frontmatter["边际效应评分"] || "",
    date: frontmatter.date || "",
    source: frontmatter["来源"] || "",
    definition: firstParagraph(section(markdown, "一句话定义")),
    stageMappings: parseStageMappings(markdown),
    marginalEffectAnalysis: firstParagraph(section(markdown, "边际效应分析")),
    applicableScenarios: parseBoundary(markdown, "✅ 适用场景"),
    unsuitableScenarios: parseBoundary(markdown, "❌ 不适用场景"),
    tools: firstParagraph(section(markdown, "工具建议")),
    tradeoffs: firstParagraph(section(markdown, "取舍偏好速查")),
    cases: firstParagraph(section(markdown, "参考案例")),
  };
});

writeFileSync(outputFile, `${JSON.stringify(templates, null, 2)}\n`);
console.log(`Generated ${templates.length} industry loop templates -> ${outputFile}`);
