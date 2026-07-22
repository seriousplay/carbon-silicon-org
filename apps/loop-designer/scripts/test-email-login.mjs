#!/usr/bin/env node

/**
 * 邮箱登录功能测试脚本
 * 用法: node scripts/test-email-login.mjs
 */

const API_URL = process.env.API_URL || "http://127.0.0.1:3000";

async function testEmailLogin() {
  console.log("🧪 测试邮箱登录 API");
  console.log("目标:", `${API_URL}/loop-designer/api/auth/email/login`);
  console.log("");

  // 测试用例 1: 缺少邮箱和密码
  console.log("测试 1: 缺少邮箱和密码");
  try {
    const res = await fetch(`${API_URL}/loop-designer/api/auth/email/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    console.log(`状态: ${res.status}`);
    console.log("响应:", data);
    console.log(res.status === 400 ? "✅ 通过" : "❌ 失败", "\n");
  } catch (err) {
    console.error("❌ 失败:", err.message, "\n");
  }

  // 测试用例 2: 仅邮箱（无密码）
  console.log("测试 2: 仅邮箱（无密码）");
  try {
    const res = await fetch(`${API_URL}/loop-designer/api/auth/email/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    const data = await res.json();
    console.log(`状态: ${res.status}`);
    console.log("响应:", data);
    console.log(res.status === 400 ? "✅ 通过" : "❌ 失败", "\n");
  } catch (err) {
    console.error("❌ 失败:", err.message, "\n");
  }

  // 测试用例 3: 无效邮箱
  console.log("测试 3: 无效邮箱");
  try {
    const res = await fetch(`${API_URL}/loop-designer/api/auth/email/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent@example.com",
        password: "wrongpassword",
      }),
    });
    const data = await res.json();
    console.log(`状态: ${res.status}`);
    console.log("响应:", data);
    console.log(res.status === 401 ? "✅ 通过" : "❌ 失败", "\n");
  } catch (err) {
    console.error("❌ 失败:", err.message, "\n");
  }

  console.log("========================================");
  console.log("测试完成");
  console.log("========================================");
  console.log("");
  console.log("💡 提示: 完整的登录测试需要：");
  console.log("1. 先在 Supabase 创建测试用户");
  console.log("2. 使用 bcrypt 加密密码");
  console.log("3. 插入到 loop_designer_users 表");
  console.log("");
  console.log("SQL 示例:");
  console.log(`
INSERT INTO loop_designer_users (
  email,
  password_hash,
  auth_provider,
  display_name,
  status,
  enterprise_id
) VALUES (
  'test@example.com',
  '\\$2b\\$10\\$your-hashed-password',  -- 使用 bcrypt.hash('password123', 10)
  'email',
  '测试用户',
  'active',
  'your-enterprise-id'  -- 可选
);
  `);
}

testEmailLogin().catch(console.error);
