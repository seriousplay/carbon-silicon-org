-- ============================================
-- 测试数据生成脚本
-- 用于测试多租户功能
-- ============================================

-- ========== 创建测试企业 ==========
INSERT INTO public.loop_designer_enterprises (tenant_key, company_name, subscription_tier, is_active, is_trial)
VALUES
  ('test_tenant_a', '测试企业A', 'free', true, true),
  ('test_tenant_b', '测试企业B', 'pro', true, false)
ON CONFLICT (tenant_key) DO NOTHING;

-- ========== 创建测试用户 ==========

-- 企业A的用户
INSERT INTO public.loop_designer_users (tenant_key, enterprise_id, open_id, union_id, display_name, status)
SELECT
  'test_tenant_a',
  e.id,
  'ou_test_a_' || gen_random_uuid()::text,
  'on_test_a',
  '测试用户A1',
  'active'
FROM public.loop_designer_enterprises e
WHERE e.tenant_key = 'test_tenant_a'
ON CONFLICT (tenant_key, open_id) DO NOTHING;

-- 企业B的用户
INSERT INTO public.loop_designer_users (tenant_key, enterprise_id, open_id, union_id, display_name, status)
SELECT
  'test_tenant_b',
  e.id,
  'ou_test_b_' || gen_random_uuid()::text,
  'on_test_b',
  '测试用户B1',
  'active'
FROM public.loop_designer_enterprises e
WHERE e.tenant_key = 'test_tenant_b'
ON CONFLICT (tenant_key, open_id) DO NOTHING;

-- ========== 创建测试会话 ==========

-- 企业A的会话
INSERT INTO public.loop_designer_sessions (user_id, enterprise_id, status, participant_snapshot, context, responses, outputs)
SELECT
  u.id,
  u.enterprise_id,
  'in_progress',
  '{"displayName": "测试用户A1"}'::jsonb,
  '{"currentStep": 2}'::jsonb,
  '{"loop": "客户交付回路"}'::jsonb,
  '{"messages": [], "versions": [], "refinementCount": 0}'::jsonb
FROM public.loop_designer_users u
WHERE u.tenant_key = 'test_tenant_a'
LIMIT 1;

-- 企业B的会话
INSERT INTO public.loop_designer_sessions (user_id, enterprise_id, status, participant_snapshot, context, responses, outputs)
SELECT
  u.id,
  u.enterprise_id,
  'submitted',
  '{"displayName": "测试用户B1"}'::jsonb,
  '{"currentStep": 5}'::jsonb,
  '{"loop": "知识生产回路"}'::jsonb,
  '{"messages": [], "versions": [], "refinementCount": 0, "currentPlan": {"title": "测试方案"}}'::jsonb
FROM public.loop_designer_users u
WHERE u.tenant_key = 'test_tenant_b'
LIMIT 1;

-- ========== 创建测试成员角色 ==========

-- 企业A成员
INSERT INTO public.loop_designer_enterprise_members (enterprise_id, user_id, role, is_active)
SELECT e.id, u.id, 'super_admin', true
FROM public.loop_designer_enterprises e
JOIN public.loop_designer_users u ON u.enterprise_id = e.id
WHERE e.tenant_key = 'test_tenant_a'
ON CONFLICT (enterprise_id, user_id) DO NOTHING;

-- 企业B成员
INSERT INTO public.loop_designer_enterprise_members (enterprise_id, user_id, role, is_active)
SELECT e.id, u.id, 'member_admin', true
FROM public.loop_designer_enterprises e
JOIN public.loop_designer_users u ON u.enterprise_id = e.id
WHERE e.tenant_key = 'test_tenant_b'
ON CONFLICT (enterprise_id, user_id) DO NOTHING;

-- ========== 创建测试审计日志 ==========
INSERT INTO public.loop_designer_audit_logs (enterprise_id, user_id, action, resource_type, resource_id, details)
SELECT e.id, u.id, 'member_added', 'user', u.id, '{"role": "super_admin"}'
FROM public.loop_designer_enterprises e
JOIN public.loop_designer_users u ON u.enterprise_id = e.id
WHERE e.tenant_key = 'test_tenant_a'
LIMIT 1;

-- ========== 创建测试企业设置 ==========
INSERT INTO public.loop_designer_enterprise_settings (enterprise_id, default_ai_model, enable_ai_claude)
SELECT id, 'step-router-v1', true
FROM public.loop_designer_enterprises
WHERE tenant_key = 'test_tenant_a'
ON CONFLICT (enterprise_id) DO NOTHING;

-- ========== 验证测试数据 ==========
SELECT
  '=== 测试数据验证 ===' as section,
  e.tenant_key,
  e.company_name,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT s.id) as session_count,
  COUNT(DISTINCT m.id) as member_count,
  COUNT(DISTINCT al.id) as audit_log_count,
  es.default_ai_model
FROM public.loop_designer_enterprises e
LEFT JOIN public.loop_designer_users u ON u.enterprise_id = e.id AND u.tenant_key = 'test_tenant_a' OR u.tenant_key = 'test_tenant_b'
LEFT JOIN public.loop_designer_sessions s ON s.enterprise_id = e.id
LEFT JOIN public.loop_designer_enterprise_members m ON m.enterprise_id = e.id
LEFT JOIN public.loop_designer_audit_logs al ON al.enterprise_id = e.id
LEFT JOIN public.loop_designer_enterprise_settings es ON es.enterprise_id = e.id
WHERE e.tenant_key IN ('test_tenant_a', 'test_tenant_b')
GROUP BY e.id, e.tenant_key, e.company_name, es.default_ai_model
ORDER BY e.tenant_key;
