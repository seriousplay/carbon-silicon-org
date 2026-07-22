# Worker 启动指南

回路OS 的定时任务由独立 Node 进程运行（`worker/index.ts`），不依赖 Vercel。

## 启动

```bash
# 开发模式（前台运行）
pnpm worker

# 生产模式（后台运行）
node --import tsx worker/index.ts &
```

## Worker 职责

每小时扫描所有组织，执行：

1. **超时检测**：张力 48h 无更新 → 站内通知（含跳转链接）
2. **DDL 临近**：张力 24h 内到期 → 通知
3. **自动升级**：调用 `detectEscalation` 检测升级信号 → 自动转移状态 + 通知
   - L0.5 紧急路径（生产故障）
   - L2 接口超 SLA 24h
   - L3 升级后 48h 未解决
   - L3 系统性（同类月内≥3次，半自动）

## 生产部署

### PM2

```bash
pm2 start "npx tsx worker/index.ts" --name loopos-worker
pm2 save
pm2 startup
```

### Docker Compose

```yaml
worker:
  build: .
  command: npx tsx worker/index.ts
  environment:
    - DATABASE_URL=postgresql://...
  restart: unless-stopped
```

## 健康检查

Worker 启动时立即执行一次扫描，之后每小时整点执行。日志输出到 stdout。

## 依赖

- `node-cron`：定时调度
- `@prisma/adapter-pg`：直连 PostgreSQL
- `src/lib/statemachine.ts`：状态机升级检测

## 故障排查

- **Worker 不扫描**：检查 `DATABASE_URL` 是否正确，数据库是否可达
- **通知不创建**：检查频控（24h 同类最多 2 次）
- **升级不触发**：检查 `detectEscalation` 的返回值（仅 `auto: true` 的信号才自动升级）
