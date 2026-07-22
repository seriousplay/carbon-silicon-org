-- Phase 2: Enterprise admin console
-- 管理员权限与审计日志

-- 1. 企业成员角色表
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
comment on column public.loop_designer_enterprise_members.role is '角色：super_admin(超级管理员)/billing_admin(计费管理员)/member_admin(成员管理员)/member(普通成员)';

-- 2. 审计日志表
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
comment on column public.loop_designer_audit_logs.action is '操作类型：user_added/user_removed/subscription_upgraded/settings_changed等';
comment on column public.loop_designer_audit_logs.resource_type is '资源类型：user/enterprise/session/setting';

-- 3. 企业设置表（可选扩展）
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

-- 4. 启用 RLS
alter table public.loop_designer_enterprise_members enable row level security;
alter table public.loop_designer_audit_logs enable row level security;
alter table public.loop_designer_enterprise_settings enable row level security;

-- 5. RLS 策略

-- 企业成员：仅 service_role 可管理
create policy enterprise_members_service_role
  on public.loop_designer_enterprise_members
  for all to service_role
  using (true)
  with check (true);

-- 审计日志：仅 service_role 可写入，企业管理员可读取
create policy audit_logs_service_role_write
  on public.loop_designer_audit_logs
  for insert to service_role
  with check (true);

create policy audit_logs_service_role_read
  on public.loop_designer_audit_logs
  for select to service_role
  using (true);

-- 企业设置：仅 service_role 可读写
create policy enterprise_settings_service_role
  on public.loop_designer_enterprise_settings
  for all to service_role
  using (true)
  with check (true);

-- 6. 索引优化
create index if not exists idx_enterprise_members_enterprise
  on public.loop_designer_enterprise_members(enterprise_id);

create index if not exists idx_enterprise_members_user
  on public.loop_designer_enterprise_members(user_id);

create index if not exists idx_audit_logs_enterprise_created
  on public.loop_designer_audit_logs(enterprise_id, created_at desc);

create index if not exists idx_audit_logs_user
  on public.loop_designer_audit_logs(user_id);

-- 7. 初始化：为现有用户创建成员记录
insert into public.loop_designer_enterprise_members (enterprise_id, user_id, role, is_active)
select u.enterprise_id, u.id, 'super_admin', true
from public.loop_designer_users u
where u.enterprise_id is not null
on conflict (enterprise_id, user_id) do nothing;

-- 8. 初始化：为现有企业创建默认设置
insert into public.loop_designer_enterprise_settings (enterprise_id)
select id from public.loop_designer_enterprises
on conflict (enterprise_id) do nothing;

-- 9. 席位管理 RPC 函数
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
