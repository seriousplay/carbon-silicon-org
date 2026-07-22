-- ============================================
-- 完整迁移脚本：Phase 1 + Phase 2
-- 在 Supabase SQL Editor 中一次性执行
-- ============================================

-- ========== Phase 1: 多租户基础架构 ==========

-- 1. 企业订阅表
create table if not exists public.loop_designer_enterprises (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null unique,
  company_name text not null,
  subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'pro', 'enterprise')),
  seat_limit int default 5,
  used_seats int default 0,
  feature_flags jsonb default '{}'::jsonb,
  billing_contact jsonb,
  is_active boolean default true,
  is_trial boolean default false,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.loop_designer_enterprises is '企业订阅与配额管理';

-- 2. 用户表添加企业外键
alter table public.loop_designer_users
  add column if not exists enterprise_id uuid references public.loop_designer_enterprises(id);

create index if not exists idx_users_enterprise
  on public.loop_designer_users(enterprise_id);

-- 3. 会话表添加企业外键
alter table public.loop_designer_sessions
  add column if not exists enterprise_id uuid references public.loop_designer_enterprises(id);

create index if not exists idx_sessions_enterprise
  on public.loop_designer_sessions(enterprise_id);

-- 4. 启用 RLS
alter table public.loop_designer_enterprises enable row level security;

create policy enterprises_service_role
  on public.loop_designer_enterprises
  for all to service_role
  using (true)
  with check (true);

-- 5. 迁移现有用户到企业表
insert into public.loop_designer_enterprises (tenant_key, company_name, is_active)
select distinct tenant_key, '默认企业', true
from public.loop_designer_users
where tenant_key is not null
on conflict (tenant_key) do nothing;

-- 6. 回填用户的 enterprise_id
update public.loop_designer_users u
set enterprise_id = e.id
from public.loop_designer_enterprises e
where u.enterprise_id is null
  and u.tenant_key = e.tenant_key;

-- 7. 回填会话的 enterprise_id
update public.loop_designer_sessions s
set enterprise_id = u.enterprise_id
from public.loop_designer_users u
where s.enterprise_id is null
  and s.user_id = u.id
  and u.enterprise_id is not null;

-- 8. 席位管理 RPC 函数
create or replace function public.increment_used_seats(p_enterprise_id uuid)
returns void as $$
begin
  update public.loop_designer_enterprises
  set used_seats = used_seats + 1,
      updated_at = now()
  where id = p_enterprise_id;
end;
$$ language plpgsql security definer;

grant execute on function public.increment_used_seats(uuid) to service_role;

create or replace function public.decrement_used_seats(p_enterprise_id uuid)
returns void as $$
begin
  update public.loop_designer_enterprises
  set used_seats = greatest(used_seats - 1, 0),
      updated_at = now()
  where id = p_enterprise_id
    and used_seats > 0;
end;
$$ language plpgsql security definer;

grant execute on function public.decrement_used_seats(uuid) to service_role;

-- ========== Phase 2: 企业管理员后台 ==========

-- 9. 企业成员角色表
create table if not exists public.loop_designer_enterprise_members (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  user_id uuid not null references public.loop_designer_users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('super_admin', 'billing_admin', 'member_admin', 'member')),
  invited_by uuid references public.loop_designer_users(id),
  is_active boolean default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (enterprise_id, user_id)
);

comment on table public.loop_designer_enterprise_members is '企业成员角色管理';

-- 10. 审计日志表
create table if not exists public.loop_designer_audit_logs (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  user_id uuid references public.loop_designer_users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.loop_designer_audit_logs is '管理员操作审计日志';

-- 11. 企业设置表
create table if not exists public.loop_designer_enterprise_settings (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade unique,
  default_ai_model text default 'step-router-v1',
  enable_ai_claude boolean default false,
  enable_custom_knowledge_base boolean default false,
  branding jsonb default '{}',
  data_retention_days int default 365,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.loop_designer_enterprise_settings is '企业级应用配置';

-- 12. 启用 RLS
alter table public.loop_designer_enterprise_members enable row level security;
alter table public.loop_designer_audit_logs enable row level security;
alter table public.loop_designer_enterprise_settings enable row level security;

-- 13. RLS 策略
create policy enterprise_members_service_role
  on public.loop_designer_enterprise_members
  for all to service_role
  using (true) with check (true);

create policy audit_logs_service_role_write
  on public.loop_designer_audit_logs
  for insert to service_role
  with check (true);

create policy audit_logs_service_role_read
  on public.loop_designer_audit_logs
  for select to service_role
  using (true);

create policy enterprise_settings_service_role
  on public.loop_designer_enterprise_settings
  for all to service_role
  using (true) with check (true);

-- 14. 索引优化
create index if not exists idx_enterprise_members_enterprise
  on public.loop_designer_enterprise_members(enterprise_id);

create index if not exists idx_enterprise_members_user
  on public.loop_designer_enterprise_members(user_id);

create index if not exists idx_audit_logs_enterprise_created
  on public.loop_designer_audit_logs(enterprise_id, created_at desc);

create index if not exists idx_audit_logs_user
  on public.loop_designer_audit_logs(user_id);

-- 15. 初始化：为现有用户创建成员记录
insert into public.loop_designer_enterprise_members (enterprise_id, user_id, role, is_active)
select u.enterprise_id, u.id, 'super_admin', true
from public.loop_designer_users u
where u.enterprise_id is not null
on conflict (enterprise_id, user_id) do nothing;

-- 16. 初始化：为现有企业创建默认设置
insert into public.loop_designer_enterprise_settings (enterprise_id)
select id from public.loop_designer_enterprises
on conflict (enterprise_id) do nothing;

-- ========== 验证查询 ==========

-- 检查所有表是否创建成功
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'loop_designer%'
ORDER BY table_name;

-- 检查企业数
SELECT COUNT(*) as enterprise_count FROM public.loop_designer_enterprises;

-- 检查成员数
SELECT COUNT(*) as member_count FROM public.loop_designer_enterprise_members;
