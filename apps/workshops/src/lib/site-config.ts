const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "一个人的组织",
  author: "你的名字",
  title: "一个人的组织｜超级个体成长手记",
  description:
    "记录一个普通人如何借助 AI，逐步获得过去只有团队才拥有的创造能力。",
  url: configuredUrl || "http://localhost:3020/journal",
  heroTitle: "我正在学习，如何借助 AI 成为一个人的组织。",
  manifesto:
    "这里没有提前写好的答案。我每周记录一次行动、结果和判断，看看一个普通人能否借助 AI，获得过去只有团队才拥有的创造能力。",
  currentQuestion: "当 AI 可以承担越来越多执行工作，个人真正需要建立的核心能力是什么？",
  about:
    "我是一名正在实践中的创造者。这个网站记录我如何把写作、研究和产品尝试连接起来，逐步形成一套属于自己的工作系统。",
  email: "",
  socialLinks: [] as Array<{ label: string; href: string }>,
};

export function absoluteUrl(pathname = "/") {
  const base = `${siteConfig.url.replace(/\/+$/, "")}/`;
  return new URL(pathname.replace(/^\/+/, ""), base).toString();
}
