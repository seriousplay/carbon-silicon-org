# 🎯 快速部署指南

最简单的部署方式，5 分钟完成。

---

## 🚀 方式 1: 交互式部署（推荐新手）

```bash
cd apps/loop-designer
./scripts/quick-deploy.sh
```

**功能**:
- ✅ 菜单式操作
- ✅ 一键完整部署
- ✅ 文档快速查看

---

## ⚡ 方式 2: 命令行部署（推荐熟手）

```bash
cd apps/loop-designer

# 1. 配置环境变量
./scripts/setup-env.sh

# 2. 构建
npm ci && npm run build

# 3. 启动
pm2 start ecosystem.config.cjs

# 4. 验证
./scripts/verify-deployment.sh
```

---

## 📋 方式 3: 手动部署（完全控制）

按照文档一步步来:

1. **[GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md)** - 完整上线清单
2. **[DATABASE_MIGRATION.md](DATABASE_MIGRATION.md)** - 数据库迁移
3. **[PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)** - 环境配置

---

## 🛠️ 可用脚本

| 脚本 | 说明 | 用法 |
|------|------|------|
| `quick-deploy.sh` | 交互式部署向导 | `./scripts/quick-deploy.sh` |
| `deploy.sh` | 自动部署脚本 | `./scripts/deploy.sh` |
| `setup-env.sh` | 环境配置向导 | `./scripts/setup-env.sh` |
| `verify-deployment.sh` | 部署验证（16项） | `./scripts/verify-deployment.sh` |
| `verify-env.mjs` | 环境变量验证 | `node scripts/verify-env.mjs` |
| `test-email-login.mjs` | 邮箱登录测试 | `node scripts/test-email-login.mjs` |

---

## ✅ 部署检查清单

- [ ] 环境变量已配置（`.env.local`）
- [ ] 数据库迁移已执行
- [ ] 依赖已安装（`npm ci`）
- [ ] 构建成功（`npm run build`）
- [ ] 服务已启动
- [ ] 部署验证通过

---

## 📚 详细文档

| 文档 | 说明 |
|------|------|
| [DEPLOY_QUICK_START.md](DEPLOY_QUICK_START.md) | 快速开始 |
| [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) | 完整上线清单 |
| [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md) | 数据库迁移 |
| [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md) | 环境配置 |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | 快速参考 |

---

**开始部署**: 运行 `./scripts/quick-deploy.sh`
