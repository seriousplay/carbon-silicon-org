export const sections = [
  {
    id: "growth-notes",
    name: "成长手记",
    shortName: "手记",
    eyebrow: "Weekly Notes",
    description: "每周记录一个真实问题、一次行动，以及判断发生的变化。",
    emptyMessage: "这个栏目正在准备第一篇记录。真实行动发生以后，内容才会出现在这里。",
  },
  {
    id: "ai-practice",
    name: "AI 实践",
    shortName: "实践",
    eyebrow: "AI Practice",
    description: "记录 AI 参与具体任务之后，真正留下了什么结果。",
    emptyMessage: "目前还没有适合公开的 AI 实践。这里不会用工具清单代替真实结果。",
  },
  {
    id: "cases",
    name: "超级个体案例",
    shortName: "案例",
    eyebrow: "Field Notes",
    description: "观察其他实践者如何把个人能力变成可持续的创造系统。",
    emptyMessage: "案例研究尚未发布。每个案例会先完成事实核查，再进入这个栏目。",
  },
  {
    id: "monthly-experiments",
    name: "月度实验",
    shortName: "实验",
    eyebrow: "Monthly Experiment",
    description: "每月选择一个问题，设定动作和判断标准，留下阶段结论。",
    emptyMessage: "第一个月度实验还在设计中。目标和验收标准明确后再公开。",
  },
] as const;

export type SectionId = (typeof sections)[number]["id"];

export const sectionIds = sections.map((section) => section.id) as [
  SectionId,
  ...SectionId[],
];

export function getSection(sectionId: string) {
  return sections.find((section) => section.id === sectionId);
}
