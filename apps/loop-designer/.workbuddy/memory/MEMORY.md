# Loop Designer — 项目记忆

## 项目概要
- 碳硅回路设计师，Next.js 16 独立子应用，basePath `/loop-designer`，端口 3010
- Supabase 后端 + 飞书 OAuth + StepFun AI 模型服务
- 核心流程：5 步对话式回路设计方案生成，支持飞书/PDF 导出

## 关键文件索引
- 商业化评估：`docs/COMMERCIAL_MATURITY_ASSESSMENT.md`
- 优化计划：`docs/OPTIMIZATION_PLAN.md`
- 当前版本：v0.1-dev，目标 v1.0-stable

## 技术约定
- 代码分层：`src/lib/`（业务逻辑，server-only）→ `src/app/api/`（路由）→ `src/components/`（UI）
- 测试：`node:test` + `tsx --test`，测试文件在 `src/lib/*.test.ts`（28 个用例）
- 环境变量：见 `.env.example`
- 构建：standalone 输出 + `scripts/prepare-standalone.mjs` 复制静态资源
- 日志：pino 结构化 JSON 日志 + traceId 追踪

## 安全变更记录（2026-06-11）
- `ignoreBuildErrors: false`（next.config.ts）
- 速率限制：登录 5次/分钟，注册 3次/小时，OAuth 10次/分钟
- CSRF 保护：登出接口 Origin/Referer 校验
- 飞书白名单：默认拒绝，需配置 FEISHU_ALLOWED_TENANT_KEY
- 密码：8字符+字母数字+弱密码黑名单+bcrypt12
- DB 原子操作：`join_enterprise_atomic` / `create_app_session_atomic` RPC
- 错误处理：统一脱敏，生产环境不泄漏内部细节
- PM2 cluster 模式

## 待完成
- P2-3: API 路由集成测试（需 Supabase 测试环境）
- P2-6: Sentry APM 接入
- P3-3: 可访问性 (a11y) 审计
- P3-4: E2E 测试（Playwright）
