# 碳硅组织 (Carbon-Silicon Organization)

**AI 时代的商业进化论** — 书籍配套网站与数字工具集

## 架构概览

```
csi-org.com
├── /book              书籍介绍 + 组织诊断工具
├── /loop-designer     回路设计器 (AI 驱动的组织设计工作室)
├── /loopos            回路操作系统 (组织治理 SaaS)
└── /workshops         工作坊合集 (超级个体 · 现场共创 · HR赋能)
```

## 技术栈

| 层 | 技术 |
|---|---|
| **框架** | Next.js 16 (App Router) + React 19 |
| **语言** | TypeScript 5 (strict) |
| **样式** | Tailwind CSS 4 + shadcn/ui |
| **数据库** | PostgreSQL 16 (本地部署) |
| **ORM** | Prisma 7 |
| **认证** | NextAuth v5 / 飞书 OAuth |
| **缓存** | Redis 7 |
| **构建** | Turborepo + pnpm workspaces |
| **部署** | PM2 + Nginx / 阿里云 ECS |
| **CI/CD** | GitHub Actions |

## 仓库结构

```
carbon-silicon-org/
├── apps/
│   ├── book/              @carbon-silicon/book         # 书籍+诊断工具
│   ├── loop-designer/     @carbon-silicon/loop-designer # 回路设计器
│   ├── loopos/            @carbon-silicon/loopos        # 回路操作系统
│   └── workshops/         @carbon-silicon/workshops     # 工作坊合集
├── packages/
│   ├── types/             @carbon-silicon/types         # 共享类型定义
│   ├── db/                @carbon-silicon/db            # 共享数据库客户端
│   └── ui/                @carbon-silicon/ui            # 共享 UI 组件
├── docker/                                              # Docker 配置
├── scripts/                                             # 部署脚本
└── .github/workflows/                                   # CI/CD
```

## 快速开始

### 环境要求
- Node.js >= 22
- pnpm >= 10.28
- PostgreSQL 16
- Redis 7 (可选)

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动所有应用
pnpm run dev

# 单独启动某个应用
pnpm run dev --filter=@carbon-silicon/book
pnpm run dev --filter=@carbon-silicon/loopos
```

### 数据库初始化

```bash
# 启动本地数据库
docker compose -f docker/docker-compose.yml up -d

# 运行迁移
pnpm run db:migrate --filter=@carbon-silicon/book
pnpm run db:migrate --filter=@carbon-silicon/loopos
```

### 构建

```bash
pnpm run build
```

### 测试

```bash
pnpm run test
pnpm run lint
```

## 生产部署

```bash
# 部署全部应用
bash scripts/deploy-all.sh all

# 部署单个应用
bash scripts/deploy-all.sh loopos
```

### 环境变量

各应用需要的环境变量见各自 `.env.example` 文件。生产环境需在阿里云 ECS 上配置：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `NEXTAUTH_SECRET` | NextAuth 加密密钥 |
| `NEXTAUTH_URL` | 站点 URL |

## 应用说明

### book (`/book`)
碳硅组织书籍介绍页 + 在线组织诊断工具。支持工作坊诊断、企业诊断、团队评估，生成螺旋模型分析报告。

- 端口: 3000
- 数据库: `csi_book`
- 认证: 邮箱 magic link

### loop-designer (`/loop-designer`)
CEO 级 AI 组织设计工具入口，将闭门会输入转化为下一代组织执行计划。

- 端口: 3010
- 数据库: `csi_loop`
- 认证: 飞书 OAuth + 邮箱密码
- AI: DeepSeek V4 Pro + Step 3.7 Flash

### loopos (`/loopos`)
回路操作系统，内部组织治理工具。实现圈子/角色结构、张力追踪、冲突升级、会议节奏和 AI 教练。

- 端口: 3040
- 数据库: `csi_loopos`
- 认证: 邮箱密码 (NextAuth v5)

### workshops (`/workshops`)
工作坊合集，包含超级个体工作坊、现场共创台、HR赋能工作坊等。

- 端口: 3030
- 数据库: 无 (静态内容驱动)
- 认证: 无 (公开站点)

## 旧应用迁移状态

| 原应用 | 新位置 | 状态 |
|---|---|---|
| carbon-silicon-tools-site | apps/book | ✅ 已迁移 |
| loop-designer | apps/loop-designer | ✅ 已迁移 (精简) |
| LLM/loopos | apps/loopos | ✅ 已迁入 |
| super-individual-site | apps/workshops | ✅ 已合并 |
| field-cocreation-site | apps/workshops | ✅ 已合并 |
| matrix-origin | — | ❌ 停止开发 |
| ontology-engine | — | ❌ 停止 |

## License

Private. All rights reserved.
