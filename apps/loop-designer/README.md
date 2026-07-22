# 碳硅组织设计工作室

“碳硅组织”系列产品的 CEO 工具入口。它承接组织进化测评、组织进化蓝图和业务回路设计，把闭门会现场输入转化为可运行的下一代组织方案。

独立 Next.js 子应用，生产路径为 `/loop-designer`，默认端口为 `3010`。推荐品牌入口为 `studio.csi-org.com`，现有兼容入口继续保留为 `loop.csi-org.com/loop-designer`。

## 本地运行

```bash
cp .env.example .env.local
npm install
npm run dev
```

本地访问 `http://localhost:3010/loop-designer`。登录由主工具站处理，因此 `NEXT_PUBLIC_SITE_URL` 应指向主工具站地址。

## 生产构建

```bash
npm ci
npm run build
pm2 start ecosystem.config.cjs
```

`npm run build` 会自动把 `.next/static` 复制到 standalone 运行目录。

Nginx 需要把 `/loop-designer/` 原样转发到 `127.0.0.1:3010`。不要移除路径前缀，Next.js `basePath` 需要接收到完整 URI。

## 环境变量

见 `.env.example`。其中：

- 模型服务默认按 `DeepSeek V4 Pro -> Step 3.7 Flash -> 旧 MODEL_*`
  顺序尝试。分别配置 `DEEPSEEK_MODEL_*` 和 `STEP_MODEL_*`；旧的
  `MODEL_API_URL` / `MODEL_API_KEY` / `MODEL_NAME` 仍可作为兼容 fallback。
- `/api/health` 默认只检查模型配置。上线前使用
  `/api/health?models=probe` 执行真实模型连通性探针，确认当前 key 和模型名可用。
- `CHROMIUM_EXECUTABLE_PATH` 指向服务器 Chromium，用于 PDF。
- 飞书应用需要新版文档创建和编辑权限。
- `FEISHU_EXPORT_FOLDER_TOKEN` 是固定共享文件夹 token。
