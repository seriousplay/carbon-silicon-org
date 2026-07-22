import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = createMetadata({
  title: "关于我｜一个人的组织",
  description: "我为什么开始这场超级个体成长实验，以及我准备如何记录它。",
  pathname: "/about",
});

const questions = [
  {
    number: "01",
    title: "我是谁",
    body: siteConfig.about,
  },
  {
    number: "02",
    title: "为什么开始",
    body: "我还没有一个足以证明自己已经成为超级个体的代表项目。与其等到结果出现后重写一段顺利的故事，我更想从能力尚未成形时开始记录。",
  },
  {
    number: "03",
    title: "什么是一个人的组织",
    body: "它不是一个人承担所有工作。我正在验证的是：个人能否借助 AI 与外部协作，持续发现问题、完成作品、交付价值，并把过程中形成的方法留下来。",
  },
  {
    number: "04",
    title: "现在在做什么",
    body: "第一阶段从写作开始。每周选择一个真实问题，记录行动、AI 的角色、可观察的结果，以及自己的判断发生了什么变化。",
  },
];

export default function AboutPage() {
  return (
    <div className="about-page shell">
      <header className="about-header">
        <p className="eyebrow">ABOUT THIS EXPERIMENT</p>
        <h1>我不想先写一份漂亮的自我介绍。</h1>
        <p>我更想让接下来发生的作品，逐步回答“我是谁”。</p>
      </header>

      <div className="about-questions">
        {questions.map((question) => (
          <section key={question.number}>
            <span>{question.number}</span>
            <h2>{question.title}</h2>
            <p>{question.body}</p>
          </section>
        ))}
      </div>

      <section className="about-promise">
        <p className="eyebrow">PUBLISHING PROMISE</p>
        <blockquote>没有行动，就不制造结论。没有结果，就不包装成果。</blockquote>
        <Link className="read-link" href="/sections/growth-notes">
          阅读成长手记 <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
