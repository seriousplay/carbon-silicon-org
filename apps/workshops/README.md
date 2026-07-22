# 超级个体个人展示网站

一个以个人杂志形式记录“如何借助 AI 成为一个人的组织”的独立 Next.js 应用。

## 本地启动

```bash
npm install
npm run dev
```

默认地址：`http://localhost:3020/journal`

## 环境变量

复制 `.env.example` 为 `.env.local`：

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3020/journal
NEXT_PUBLIC_SITE_NAME=一个人的组织
```

生产环境必须将 `NEXT_PUBLIC_SITE_URL` 设置为正式站点地址，否则 sitemap、RSS 和 canonical URL 会指向本地地址。

当前生产路径：`https://carbon.daodecision.com/journal`

## 发布文章

在 `content/articles` 新增 Markdown 文件：

```md
---
title: "文章标题"
slug: "article-slug"
section: "growth-notes"
summary: "文章摘要"
publishedAt: "2026-06-07"
status: "published"
aiRole: "AI 在本文中的作用"
tags:
  - "超级个体"
---

正文从这里开始。
```

可用栏目：

- `growth-notes`
- `ai-practice`
- `cases`
- `monthly-experiments`

将 `status` 设为 `draft` 时，文章不会进入页面、RSS 或 sitemap。

## 上线前替换

在 `src/lib/site-config.ts` 更新：

- `author`
- `heroTitle`
- `manifesto`
- `currentQuestion`
- `about`
- 社交链接

首页目前使用明确的照片占位框。提供真实照片后，应将该区域替换为 `next/image`，并保留准确的替代文本。

## 验证

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## 当前边界

- 无后台和数据库；
- 无订阅、评论和登录；
- 不公开提示词、收入或内部工作流；
- 不展示虚构成果、客户和证言。
