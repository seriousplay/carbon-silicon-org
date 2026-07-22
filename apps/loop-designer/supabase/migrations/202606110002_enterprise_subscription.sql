-- Phase 1: Enterprise & Subscription Management
-- 创建企业、订阅、成员管理相关的所有表

-- 1. Enterprises 表
create table if not exists public.loop_designer_enterprises (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null unique,
  company_name text not null,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro', 'enterprise')),
  seat_limit integer not null default 5,
  used_seats integer not null default 0,
  feature_flags jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_trial boolean not null default false,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seat_limit_positive check (seat_limit >= 0),
  constraint used_seats_non_negative check (used_seats >= 0)
);

create index if not exists loop_designer_enterprises_tenant_key_idx
  on public.loop_designer_enterprises (tenant_key);

-- 2. Enterprise Members 表
create table if not exists public.loop_designer_enterprise_members (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  user_id uuid not null references public.loop_designer_users(id) on delete cascade,
  role text not null default 'member' check (role in ('super_admin', 'billing_admin', 'member_admin', 'member')),
  invited_by uuid references public.loop_designer_users(id) on delete set null,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enterprise_id, user_id)
);

create index if not exists loop_designer_enterprise_members_enterprise_idx
  on public.loop_designer_enterprise_members (enterprise_id, is_active);

create index if not exists loop_designer_enterprise_members_user_idx
  on public.loop_designer_enterprise_members (user_id, is_active);

-- 3. Invite Codes 表
create table if not exists public.loop_designer_invite_codes (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.loop_designer_users(id) on delete restrict,
  max_uses integer not null default 0, -- 0 = 无限制
  used_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint max_uses_non_negative check (max_uses >= 0),
  constraint used_count_non_negative check (used_count >= 0)
);

create index if not exists loop_designer_invite_codes_enterprise_idx
  on public.loop_designer_invite_codes (enterprise_id, is_active);

create index if not exists loop_designer_invite_codes_code_idx
  on public.loop_designer_invite_codes (code) where is_active = true;

-- 4. Audit Logs 表
create table if not exists public.loop_designer_audit_logs (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  user_id uuid references public.loop_designer_users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists loop_designer_audit_logs_enterprise_idx
  on public.loop_designer_audit_logs (enterprise_id, created_at desc);

create index if not exists loop_designer_audit_logs_user_idx
  on public.loop_designer_audit_logs (user_id, created_at desc);

-- 5. Enterprise Settings 表
create table if not exists public.loop_designer_enterprise_settings (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null unique references public.loop_designer_enterprises(id) on delete cascade,
  default_ai_model text not null default 'step-router-v1',
  enable_ai_claude boolean not null default false,
  enable_custom_knowledge_base boolean not null default false,
  branding jsonb not null default '{}'::jsonb,
  data_retention_days integer not null default 365,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retention_days_positive check (data_retention_days >= 1)
);

create index if not exists loop_designer_enterprise_settings_enterprise_idx
  on public.loop_designer_enterprise_settings (enterprise_id);

-- 6. 更新 Users 表添加邮箱登录字段
alter table public.loop_designer_users
  add column if not exists email text unique,
  add column if not exists password_hash text,
  add column if not exists auth_provider text not null default 'feishu' check (auth_provider in ('feishu', 'email')),
  add column if not exists enterprise_id uuid references public.loop_designer_enterprises(id) on delete set null;

create index if not exists loop_designer_users_email_idx
  on public.loop_designer_users (email) where email is not null;

create index if not exists loop_designer_users_enterprise_idx
  on public.loop_designer_users (enterprise_id);

-- 7. RPC Functions: 席位管理原子操作
create or replace function public.increment_used_seats(p_enterprise_id uuid)
returns void as $$
begin
  update public.loop_designer_enterprises
  set used_seats = used_seats + 1,
      updated_at = now()
  where id = p_enterprise_id
    and used_seats < seat_limit; -- 防止超出配额
end;
$$ language plpgsql security definer;

create or replace function public.decrement_used_seats(p_enterprise_id uuid)
returns void as $$
begin
  update public.loop_designer_enterprises
  set used_seats = greatest(0, used_seats - 1),
      updated_at = now()
  where id = p_enterprise_id;
end;
$$ language plpgsql security definer;

-- 8. 启用 RLS
alter table public.loop_designer_enterprises enable row level security;
alter table public.loop_designer_enterprise_members enable row level security;
alter table public.loop_designer_invite_codes enable row level security;
alter table public.loop_designer_audit_logs enable row level security;
alter table public.loop_designer_enterprise_settings enable row level security;

-- 9. 更新 users 表的 RLS 策略（添加 email 字段的访问权限）
-- 原有策略保持不变，这里添加新的访问路径

-- 10. 撤销权限（保持安全策略）
revoke all on public.loop_designer_enterprises from anon, authenticated;
revoke all on public.loop_designer_enterprise_members from anon, authenticated;
revoke all on public.loop_designer_invite_codes from anon, authenticated;
revoke all on public.loop_designer_audit_logs from anon, authenticated;
revoke all on public.loop_designer_enterprise_settings from anon, authenticated;

-- 11. 辅助视图：企业成员详情（包含用户信息）
create or replace view public.enterprise_members_with_users as
select
  m.id as member_id,
  m.enterprise_id,
  m.user_id,
  m.role,
  m.invited_by,
  m.is_active,
  m.joined_at,
  m.left_at,
  u.display_name as user_display_name,
  u.avatar_url as user_avatar_url,
  u.email as user_email
from public.loop_designer_enterprise_members m
join public.loop_designer_users u on u.id = m.user_id;

-- 12. 辅助视图：邀请码详情
create or replace view public.invite_codes_with_details as
select
  ic.id,
  ic.enterprise_id,
  ic.code,
  ic.created_by,
  ic.max_uses,
  ic.used_count,
  ic.expires_at,
  ic.is_active,
  ic.created_at,
  e.company_name as enterprise_name,
  u.display_name as created_by_name
from public.loop_designer_invite_codes ic
join public.loop_designer_enterprises e on e.id = ic.enterprise_id
join public.loop_designer_users u on u.id = ic.created_by;
