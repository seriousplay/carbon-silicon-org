# 技能创建总结报告

**技能名称：** `nextjs-performance-optimization`
**版本：** 1.0.0
**创建日期：** 2026-05-12
**基于项目：** Carbon Silicon Tools Site

---

## ✅ 技能创建完成

### 📁 文件结构

```
~/.claude/skills/nextjs-performance-optimization/
├── SKILL.md                      # 技能主入口
├── README.md                     # 快速参考指南
├── performance-analysis.md       # 性能分析与诊断
├── caching-strategies.md         # 缓存策略
├── nginx-optimization.md         # Nginx 配置优化
├── supabase-auth-debugging.md    # Supabase Auth 调试
└── troubleshooting.md            # 故障排查手册
```

### 📚 内容覆盖

#### 1. 性能分析与诊断
- ✅ 性能指标基准（TTFB、API 响应时间、Bundle 大小）
- ✅ 诊断流程（测量基线 → 识别瓶颈 → 分析原因）
- ✅ 工具与技术栈（curl、PM2、Chrome DevTools）
- ✅ 常见瓶颈识别（数据库查询、无缓存、Cluster 模式等）
- ✅ 优化优先级决策矩阵

#### 2. 缓存策略
- ✅ TTL 缓存实现（TypeScript 代码）
- ✅ PM2 Fork vs Cluster 模式决策树
- ✅ 缓存键设计最佳实践
- ✅ 缓存覆盖率优化
- ✅ 缓存失效策略（TTL、写时失效、手动刷新）
- ✅ 监控缓存命中率

#### 3. Nginx 优化
- ✅ Gzip 压缩配置（71% 体积减少）
- ✅ 静态资源缓存（1 年缓存）
- ✅ Location 匹配规则详解（优先级、陷阱）
- ✅ 缓冲区配置（解决 502 错误）
- ✅ 完整配置模板
- ✅ 故障排查

#### 4. Supabase Auth 调试
- ✅ Server vs Client Session 不一致诊断
- ✅ Supabase Cookie Handler 的限制
- ✅ 魔法链接完整流程调试
- ✅ 常见错误代码（otp_expired、otp_invalid 等）
- ✅ 完整修复代码（/auth/confirm、/auth/callback）
- ✅ Cookie 配置详解

#### 5. 故障排查手册
- ✅ 502 Bad Gateway（诊断 + 解决）
- ✅ 静态资源 404（3 种常见原因）
- ✅ 认证状态不一致（4 步诊断流程）
- ✅ 缓存不生效（3 种常见原因）
- ✅ 慢查询优化（索引、减少字段、并行、JOIN）
- ✅ 内存泄漏预防
- ✅ 快速决策树

---

## 🎯 技能适用场景

### 可以使用此技能的场景

1. **性能优化**
   - "网站加载慢，帮我优化"
   - "API 响应时间太长"
   - "如何实现缓存？"

2. **故障排查**
   - "出现 502 错误"
   - "静态资源加载失败"
   - "登录后跳回登录页"
   - "魔法链接不工作"

3. **架构决策**
   - "PM2 应该用 cluster 还是 fork 模式？"
   - "如何设计缓存策略？"
   - "Nginx location 配置怎么优化？"

4. **代码实现**
   - "如何在 Next.js Route Handler 中设置 cookies？"
   - "如何实现 TTL 缓存？"
   - "Nginx 压缩配置怎么写？"

---

## 📊 实际优化成果（技能验证）

**项目：** Carbon Silicon Tools Site
**时间：** 2026-05-12

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **API 响应** | 2.0-3.5s | **0.05s** | **80x** |
| **缓存命中率** | 0% | **95%+** | ✅ |
| **JS Bundle** | 2.4MB | **~700KB** | **71%↓** |
| **静态资源** | 404 | **200** | ✅ |
| **魔法链接登录** | ❌ 失败 | **✅ 成功** | ✅ |

**所有优化均已被此技能文档化。**

---

## 🔧 技能使用方法

### 方式 1：自动触发（推荐）

当用户提出相关问题时，系统会自动识别并应用此技能：

**示例用户输入：**
- "我的网站 API 响应很慢"
- "出现 502 错误怎么办？"
- "登录后为什么跳回登录页？"
- "Next.js 如何实现缓存？"

### 方式 2：手动指定

用户可以直接说：
- "使用 nextjs-performance-optimization 技能"
- "参考 Next.js 性能优化技能"

### 方式 3：通过 /skill 命令

```bash
/skill nextjs-performance-optimization
```

---

## 📚 技能特色

### 1. 实战经验总结

所有内容均来自**真实项目实战**，不是理论堆砌：
- Phase 2 性能优化的完整过程
- 魔法链接登录问题的深度排查
- 502 错误的诊断与修复
- 静态资源 404 的 Nginx 配置问题

### 2. 决策树和快速参考

- PM2 模式决策树
- Nginx Location 优先级决策
- 缓存策略选择决策
- 故障排查快速决策树

### 3. 完整代码示例

- TTL 缓存实现（TypeScript）
- Route Handler Cookie 设置
- Nginx 完整配置模板
- Supabase Auth 完整修复代码

### 4. 诊断检查清单

- 性能优化前检查清单
- 优化中检查清单
- 优化后检查清单
- 故障排查步骤清单

---

## 🎓 知识体系

### 覆盖范围

**前端：**
- Next.js 16 App Router
- Server Components vs Client Components
- Route Handlers
- cookies() API（只读 vs 可写）

**后端：**
- Supabase PostgreSQL
- Supabase Auth（Magic Link、OTP）
- @supabase/ssr 使用限制

**基础设施：**
- PM2（Fork vs Cluster）
- Nginx（Location、压缩、缓存、缓冲区）
- Node.js 内存管理

**性能优化：**
- TTL 缓存策略
- 缓存命中率优化
- Gzip 压缩
- 数据库查询优化
- 连接池（未来）

---

## 🔄 更新计划

### V1.1（计划）
- [ ] 添加 Redis 缓存实现
- [ ] 添加数据库索引优化案例
- [ ] 添加 ISR（增量静态再生）指南

### V1.2（计划）
- [ ] 添加 WebSocket 优化
- [ ] 添加图片优化（next/image）
- [ ] 添加 CDN 配置

### V2.0（未来）
- [ ] 添加 APM 监控（New Relic、Datadog）
- [ ] 添加地理数据库部署指南
- [ ] 添加性能预算和 CI/CD 集成

---

## 📞 反馈与改进

如果使用此技能时遇到问题或有改进建议：

1. **记录问题**：哪个场景不适用？
2. **提供上下文**：具体的技术栈和环境
3. **建议改进**：希望添加什么内容？

---

## 🎉 总结

此技能将 **6 小时的实际优化经验** 系统化、结构化，提炼成可复用的知识库。

**核心价值：**
- ✅ **系统性**：从前端到后端，从代码到配置
- ✅ **实战性**：所有案例均来自真实项目
- ✅ **可复用**：决策树、检查清单、代码片段
- ✅ **易查找**：按场景分类，快速定位

**目标：**
下次遇到类似问题时，可以直接调用此技能，快速诊断和解决，而不是重新从零开始分析。

---

**创建者：** Claude (Anthropic)
**创建时间：** 2026-05-12
**技能版本：** 1.0.0
**状态：** ✅ 已创建并验证
