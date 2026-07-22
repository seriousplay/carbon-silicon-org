import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "../..");
const sourcePath = path.join(appRoot, "src/lib/tools/tool-products.json");
const outputDir = path.join(repoRoot, "docs/tool-products");

const onlineLabels = {
  assessment: "可立即在线测评",
  template: "可在线使用并沉淀记录",
  manual: "可由引导师按手册交付",
  planned: "待增强为深度在线版",
};

const typeLabels = {
  assessment: "测评诊断",
  diagnosis: "组织诊断",
  governance: "治理工具",
  practice: "练习任务",
  strategy: "策略判断",
  template: "交付模板",
  workflow: "流程设计",
  workshop: "工作坊",
};

function list(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function numberedSteps(steps) {
  return steps
    .map(
      (step, index) => `${index + 1}. **${step.title}**\n   - 学员指令：${step.instruction}\n   - 产出：${step.output}`,
    )
    .join("\n");
}

function templateSections(sections) {
  return sections
    .map((section) => `### ${section.title}\n\n${section.prompts.map(templatePrompt).join("\n\n")}`)
    .join("\n\n");
}

function templatePrompt(prompt) {
  if (typeof prompt === "string") return `- ${prompt}`;

  return [
    `#### ${prompt.label}`,
    prompt.standard ? `**填写标准**：${prompt.standard}` : "",
    prompt.example ? `**示例**：${prompt.example}` : "",
    prompt.avoid ? `**避免写法**：${prompt.avoid}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function manual(tool) {
  return `# ${tool.name}｜需求设计手册

## 1. 产品定位

**所属章节**：第 ${tool.chapter} 章

**工具类型**：${typeLabels[tool.toolType]}

**使用方式**：${onlineLabels[tool.onlineSupport]}

**一句话价值**：${tool.purpose}

**核心产出**：${tool.output}

**目标用户**：

${list(tool.targetUsers)}

**交付条件**：

- 建议时长：${tool.duration}
- 参与人数：${tool.participants}
- 适用场景：${tool.scenarioTags.join(" / ")}

## 2. 用户任务

### 解决的问题

${tool.problem}

### 适合使用

${list(tool.whenToUse)}

### 不适合使用

${list(tool.notFor)}

## 3. 交付流程

### 输入材料

${list(tool.inputs)}

### 操作步骤

${numberedSteps(tool.steps)}

## 4. 学员指令与输出模板

${templateSections(tool.templateSections)}

## 5. 解释口径

${list(tool.scoring)}

## 6. 引导师手册

### 引导师提示

${list(tool.facilitatorTips)}

### 常见误区

${list(tool.pitfalls)}

### 后续行动

${list(tool.followUpActions)}

## 7. 开发规格

### 表单字段

${list(tool.developmentSpec.formFields)}

### 报告模块

${list(tool.developmentSpec.reportBlocks)}

### 验收标准

${list(tool.developmentSpec.acceptanceCriteria)}

### 推荐搭配工具

${list(tool.relatedTools)}
`;
}

const tools = JSON.parse(await readFile(sourcePath, "utf8"));
await mkdir(outputDir, { recursive: true });

await Promise.all(
  tools.map((tool) => writeFile(path.join(outputDir, `${tool.id}.md`), manual(tool), "utf8")),
);

console.log(`Generated ${tools.length} tool product manuals in ${path.relative(repoRoot, outputDir)}`);
