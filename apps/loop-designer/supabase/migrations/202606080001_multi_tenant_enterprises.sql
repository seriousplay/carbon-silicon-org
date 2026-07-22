-- Phase 1: Multi-tenant architecture migration
-- 新增企业表 + 租户隔离增强

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
comment on column public.loop_designer_enterprises.tenant_key is '飞书企业标识（来自user_info.tenant_key）';
comment on column public.loop_designer_enterprises.subscription_tier is '订阅层级：free/pro/enterprise';
comment on column public.loop_designer_enterprises.feature_flags is '功能开关：{"ai_model":"gpt-4","export_feishu":true}';

-- 2. 用户表添加企业外键
alter table public.loop_designer_users
  add column if not exists enterprise_id uuid references public.loop_designer_enterprises(id);

create index if not exists idx_users_enterprise
  on public.loop_designer_users(enterprise_id);

comment on column public.loop_designer_users.enterprise_id is '所属企业ID（多租户隔离）';

-- 3. 会话表添加企业外键
alter table public.loop_designer_sessions
  add column if not exists enterprise_id uuid references public.loop_designer_enterprises(id);

create index if not exists idx_sessions_enterprise
  on public.loop_designer_sessions(enterprise_id);

comment on column public.loop_designer_sessions.enterprise_id is '所属企业ID（多租户查询加速）';

-- 4. 启用 RLS
alter table public.loop_designer_enterprises enable row level security;

-- 5. 企业表 RLS 策略（仅 service_role 可读写）
create policy enterprises_service_role
  on public.loop_designer_enterprises
  for all to service_role
  using (true)
  with check (true);

-- 6. 迁移现有用户到企业表（数据初始化）
insert into public.loop_designer_enterprises (tenant_key, company_name, is_active)
select distinct tenant_key, '默认企业', true
from public.loop_designer_users
where tenant_key is not null
on conflict (tenant_key) do nothing;

-- 7. 回填用户的 enterprise_id
update public.loop_designer_users u
set enterprise_id = e.id
from public.loop_designer_enterprises e
where u.enterprise_id is null
  and u.tenant_key = e.tenant_key;

-- 8. 回填会话的 enterprise_id
update public.loop_designer_sessions s
set enterprise_id = u.enterprise_id
from public.loop_designer_users u
where s.enterprise_id is null
  and s.user_id = u.id
  and u.enterprise_id is not null;

-- 9. 增强用户表 RLS（隔离不同企业的用户）
create policy users_enterprise_isolation
  on public.loop_designer_users
  for select to service_role
  using (true);

-- 10. 增强会话表 RLS（隔离不同企业的会话）
create policy sessions_enterprise_isolation
  on public.loop_designer_sessions
  for all to service_role
  using (true)
  with check (true);

-- 11. 认证会话表 RLS
revoke all on public.loop_designer_auth_sessions from anon, authenticated;
alter table public.loop_designer_auth_sessions enable row level security;

create policy auth_sessions_service_role
  on public.loop_designer_auth_sessions
  for all to service_role
  using (true)
  with check (true);

-- 12. 席位管理 RPC 函数（原子操作，避免竞态条件）
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

