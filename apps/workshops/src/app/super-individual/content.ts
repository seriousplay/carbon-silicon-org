export const schedule = [
  {
    time: "09:30-10:00",
    title: "开场与目标校准",
    text: "重新定义超级个体：不是会很多工具，而是能把专业判断封装进 AI 工作流。",
    output: "当天任务与交付物",
  },
  {
    time: "10:00-10:40",
    title: "真实任务选择",
    text: "按方案、表达、分析、知识转化四类赛道，选定一个真实内容任务。",
    output: "任务 Brief",
  },
  {
    time: "10:40-11:10",
    title: "普通 AI 生成",
    text: "用 StepClaw 直接生成一次内容，观察普通 prompt 的空泛、套话和不可交付问题。",
    output: "初稿 v0.3",
  },
  {
    time: "11:10-12:00",
    title: "从 Prompt 到 Skill",
    text: "拆解成熟 Skill 样例，再用一个学员真实任务公开示范如何封装工作流。",
    output: "Skill 结构认知",
  },
  {
    time: "12:00-13:30",
    title: "午休",
    text: "可选个别答疑，调整任务边界，补充材料。",
    output: "任务修正",
  },
  {
    time: "13:30-14:20",
    title: "创建个人 Skill 雏形",
    text: "把自己的任务拆成输入材料、AI 角色、执行步骤、输出格式和质量标准。",
    output: "Skill 卡片",
  },
  {
    time: "14:20-15:20",
    title: "用 Skill 重跑内容",
    text: "结合 StepClaw、ima 和 Obsidian 中的材料，把内容从粗稿推进到可继续交付的版本。",
    output: "内容初稿 v0.8",
  },
  {
    time: "15:35-16:25",
    title: "小班案例诊所",
    text: "抽 2-3 个案例公开点评，比较普通输出和 Skill 化输出的差异。",
    output: "修改建议",
  },
  {
    time: "16:25-17:00",
    title: "模板沉淀与行动承诺",
    text: "完成一页纸 AI 内容工作流模板，并设定 7 天内复用场景。",
    output: "复用计划",
  },
];

export const tools = [
  {
    name: "StepClaw",
    label: "现场主工具",
    href: "https://www.stepfun.com/openclaw",
    text: "用于统一完成 AI 对话、任务拆解、工作流和 Skill 训练。请课前安装并登录。",
  },
  {
    name: "ima",
    label: "远程知识库",
    href: "https://ima.qq.com/",
    text: "用于保存、检索和复用资料。请提前创建知识库，并导入一份非敏感材料。",
  },
  {
    name: "Obsidian",
    label: "本地知识库",
    href: "https://obsidian.md/download",
    text: "用于长期保存个人模板、笔记、Skill 卡片和内容输出结果。",
  },
  {
    name: "OpenClaw",
    label: "替代 / 进阶",
    href: "https://openclaw.ai/",
    text: "已经有智能体经验的学员可以作为替代或进阶探索，但现场主线以 StepClaw 为准。",
  },
];

export const prework = [
  "读完 AI 入门迷你课：AI 套娃、数据厨房、学习范式、大模型、Agent、Skills、Harness、真实产品和安全边界。",
  "安装 StepClaw、ima、Obsidian，并完成一次登录或初始化。",
  "准备一份非敏感真实材料，例如 JD、会议纪要、培训材料、制度文档或文章草稿。",
  "用 StepClaw 做一次简单处理：总结、改写、提取问题、生成大纲、转 FAQ 均可。",
  "填写课前问卷，说明你的 AI 经验、工作场景和现场想完成的任务。",
];

export const taskTracks = [
  { title: "方案 / 表达", text: "培训方案、招聘方案、文章、发言稿、课程大纲。" },
  { title: "分析 / 总结", text: "会议纪要、访谈总结、调研报告、问题诊断。" },
  { title: "知识转化", text: "SOP、FAQ、知识库条目、操作清单、培训材料。" },
];
