-- ============================================
-- Phase 1 + Phase 2 迁移验证脚本
-- 在 Supabase SQL Editor 中执行此脚本验证迁移
-- ============================================

-- ========== 1. 检查所有表 ==========
SELECT
  '=== 表结构验证 ===' as section,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name LIKE 'loop_designer%'
ORDER BY table_name;

-- ========== 2. 检查企业数据 ==========
SELECT
  '=== 企业数据 ===' as section,
  COUNT(*) as total_enterprises,
  COUNT(*) FILTER (WHERE is_active = true) as active_enterprises,
  COUNT(*) FILTER (WHERE is_trial = true) as trial_enterprises,
  SUM(used_seats) as total_used_seats,
  SUM(seat_limit) as total_seat_limit
FROM public.loop_designer_enterprises;

-- ========== 3. 检查用户数据 ==========
SELECT
  '=== 用户数据 ===' as section,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE enterprise_id IS NOT NULL) as users_with_enterprise,
  COUNT(*) FILTER (WHERE enterprise_id IS NULL) as users_without_enterprise,
  COUNT(DISTINCT tenant_key) as distinct_tenants
FROM public.loop_designer_users;

-- ========== 4. 检查会话数据 ==========
SELECT
  '=== 会话数据 ===' as section,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE enterprise_id IS NOT NULL) as sessions_with_enterprise,
  COUNT(*) FILTER (WHERE enterprise_id IS NULL) as sessions_without_enterprise,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
  COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
  COUNT(*) FILTER (WHERE status = 'generating') as generating,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM public.loop_designer_sessions;

-- ========== 5. 检查成员角色 ==========
SELECT
  '=== 成员角色 ===' as section,
  role,
  COUNT(*) as count
FROM public.loop_designer_enterprise_members
GROUP BY role
ORDER BY role;

-- ========== 6. 检查审计日志 ==========
SELECT
  '=== 审计日志 ===' as section,
  COUNT(*) as total_logs,
  COUNT(DISTINCT action) as distinct_actions,
  COUNT(DISTINCT user_id) as distinct_users,
  MIN(created_at) as earliest_log,
  MAX(created_at) as latest_log
FROM public.loop_designer_audit_logs;

-- ========== 7. 检查企业设置 ==========
SELECT
  '=== 企业设置 ===' as section,
  COUNT(*) as total_settings,
  COUNT(*) FILTER (WHERE default_ai_model IS NOT NULL) as has_ai_model,
  COUNT(*) FILTER (WHERE enable_ai_claude = true) as claude_enabled,
  COUNT(*) FILTER (WHERE enable_custom_knowledge_base = true) as knowledge_base_enabled
FROM public.loop_designer_enterprise_settings;

-- ========== 8. 检查 RPC 函数 ==========
SELECT
  '=== RPC 函数 ===' as section,
  proname as function_name,
  prosrc as function_body
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname LIKE '%used_seats%'
ORDER BY proname;

-- ========== 9. 检查 RLS 策略 ==========
SELECT
  '=== RLS 策略 ===' as section,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename LIKE 'loop_designer%'
ORDER BY tablename, policyname;

-- ========== 10. 数据完整性检查 ==========
SELECT
  '=== 数据完整性 ===' as section,
  '用户缺少企业ID' as check_type,
  COUNT(*) as issue_count
FROM public.loop_designer_users
WHERE enterprise_id IS NULL

UNION ALL

SELECT
  '=== 数据完整性 ===' as section,
  '会话缺少企业ID' as check_type,
  COUNT(*) as issue_count
FROM public.loop_designer_sessions
WHERE enterprise_id IS NULL

UNION ALL

SELECT
  '=== 数据完整性 ===' as section,
  '成员缺少企业ID' as check_type,
  COUNT(*) as issue_count
FROM public.loop_designer_enterprise_members
WHERE enterprise_id IS NULL

UNION ALL

SELECT
  '=== 数据完整性 ===' as section,
  '企业没有设置记录' as check_type,
  COUNT(*) as issue_count
FROM public.loop_designer_enterprises e
LEFT JOIN public.loop_designer_enterprise_settings s ON e.id = s.enterprise_id
WHERE s.id IS NULL;

-- ========== 11. 企业-用户-会话关系验证 ==========
SELECT
  '=== 关系验证 ===' as section,
  e.tenant_key,
  e.company_name,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT s.id) as session_count,
  e.seat_limit,
  e.used_seats
FROM public.loop_designer_enterprises e
LEFT JOIN public.loop_designer_users u ON u.enterprise_id = e.id
LEFT JOIN public.loop_designer_sessions s ON s.enterprise_id = e.id
GROUP BY e.id, e.tenant_key, e.company_name, e.seat_limit, e.used_seats
ORDER BY e.created_at DESC;

-- ========== 12. 总结 ==========
SELECT
  '=== 迁移验证总结 ===' as section,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'loop_designer%') as total_tables,
  (SELECT COUNT(*) FROM public.loop_designer_enterprises) as enterprises,
  (SELECT COUNT(*) FROM public.loop_designer_users) as users,
  (SELECT COUNT(*) FROM public.loop_designer_sessions) as sessions,
  (SELECT COUNT(*) FROM public.loop_designer_enterprise_members) as members,
  (SELECT COUNT(*) FROM public.loop_designer_audit_logs) as audit_logs,
  (SELECT COUNT(*) FROM public.loop_designer_enterprise_settings) as settings,
  (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%used_seats%') as rpc_functions,
  CASE
    WHEN (SELECT COUNT(*) FROM public.loop_designer_users WHERE enterprise_id IS NULL) = 0
     AND (SELECT COUNT(*) FROM public.loop_designer_sessions WHERE enterprise_id IS NULL) = 0
    THEN '✅ 数据完整性检查通过'
    ELSE '⚠️ 存在数据完整性问题'
  END as data_integrity_status;
