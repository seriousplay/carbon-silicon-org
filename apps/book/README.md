# 碳硅组织工具站 MVP

《碳硅组织》书籍、工作坊与企业诊断的延伸产品。当前版本支持混合模式入口：工作坊、企业诊断、内部班级和公开测评。

## 功能范围

- 测评入口：`/e/[runSlug]`
- 参与者基础信息填写
- 核心测评：五级阶梯、三螺旋、意义-权力-信任、人机链路、AI 宪章
- 个人报告：`/report/[reportId]`
- 工具库：`/tools`
- 入口管理：`/admin/runs`
- 创建入口：`/admin/runs/new`
- 入口后台：`/admin/runs/[runSlug]`
- 汇总报告：`/admin/runs/[runSlug]/report`
- 旧入口兼容：`/admin/events/20260517`
- 浏览器打印 / 保存 PDF
- 入口运营：状态切换、访问码、CSV 导出、测试样本清理

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

## 环境变量

复制 `.env.example` 为 `.env.local`，填入 Supabase 配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://uxaxvzqskqsujmlmxvhj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

注意：

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 会进入浏览器 bundle。
- `SUPABASE_SERVICE_ROLE_KEY` 只能放在服务端环境变量中，不能提交到仓库。
- 生产环境将 `NEXT_PUBLIC_SITE_URL` 设置为正式域名，例如 `https://carbon.daodecision.com`，用于生成登录邮件回跳链接。
- `.env*` 已被 `.gitignore` 忽略。
- 测评提交走 `/api/assessments` 服务端路由，浏览器端不会直接写入 Supabase 表。
- 未配置 Supabase 环境变量时，系统会以本地报告和 demo 汇总模式运行，便于课程开发组先行体验。

## Supabase 初始化

在 Supabase SQL Editor 中执行：

```text
supabase/schema.sql
```

该脚本会创建基础表、插入 5.17 示例入口，并配置 V0.2 混合模式需要的字段和 RLS 策略。脚本可重复执行。

## 验证命令

```bash
npm run lint
npm run build
```

端到端手工路径：

1. 进入 `/admin/runs/new` 创建一个测试入口
2. 进入 `/e/[runSlug]/start`
3. 填写基础信息
4. 完成 6 个测评模块
5. 查看个人报告并打印 PDF
6. 打开 `/tools`
7. 打开 `/admin/runs/[runSlug]`
8. 设置访问码后，验证错误访问码无法进入测评
9. 导出 CSV，确认报告和开放题字段可用于复盘

## 部署到 Vercel

1. 新建 Vercel 项目，Root Directory 选择 `apps/carbon-silicon-tools-site`。
2. 配置环境变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. 部署后检查：
   - 首页
   - 活动入口
   - 入口创建
   - 测评提交
   - 个人报告
   - 入口后台
   - 打印 PDF

## 部署到阿里云服务器

当前阿里云服务器：

```text
http://47.95.199.142/
```

服务器运行方式：

- Node.js 22
- `pm2` 管理 Next.js 进程：`carbon-silicon-tools-site`
- `nginx` 反向代理公网 80 端口到本机 `3000`
- 服务器生产环境变量文件：`/var/www/carbon-silicon-org-book/apps/carbon-silicon-tools-site/.env.production`

从本机同步并部署：

```bash
apps/carbon-silicon-tools-site/scripts/deploy-aliyun.sh
```

可选覆盖：

```bash
ALIYUN_KEY=~/.ssh/daodecision_aliyun.pem apps/carbon-silicon-tools-site/scripts/deploy-aliyun.sh
```
