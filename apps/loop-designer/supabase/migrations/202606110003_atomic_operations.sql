-- Phase: Security hardening — atomic DB operations
-- Wraps multi-step operations in PL/pgSQL transactions to prevent partial writes.

-- 1. Atomic join-enterprise via invite code
-- Consumes invite code, adds member, updates user enterprise, adjusts seats, all-or-nothing.
create or replace function public.join_enterprise_atomic(
  p_invite_code text,
  p_user_id uuid
)
returns jsonb as $$
declare
  v_invite record;
  v_existing_member record;
  v_old_enterprise_id uuid;
begin
  -- Step 1: Validate, check seat availability, and lock the invite code
  select ic.id, ic.enterprise_id, ic.max_uses, ic.used_count, e.company_name
  into v_invite
  from public.loop_designer_invite_codes ic
  join public.loop_designer_enterprises e on e.id = ic.enterprise_id
  where ic.code = p_invite_code
    and ic.is_active = true
    and (ic.expires_at is null or ic.expires_at > now())
    and (ic.max_uses = 0 or ic.used_count < ic.max_uses)
    and e.used_seats < e.seat_limit
  for update of ic; -- row-level lock prevents concurrent consumption

  if not found then
    return jsonb_build_object('success', false, 'error', '邀请码无效、已过期或企业席位已满');
  end if;

  -- Step 2: Check existing membership
  select id, is_active into v_existing_member
  from public.loop_designer_enterprise_members
  where enterprise_id = v_invite.enterprise_id
    and user_id = p_user_id;

  if found and v_existing_member.is_active then
    return jsonb_build_object('success', true, 'message', '你已在该企业中', 'already_member', true);
  end if;

  -- Step 3: Save old enterprise for seat release
  select enterprise_id into v_old_enterprise_id
  from public.loop_designer_users
  where id = p_user_id;

  -- Step 4: Consume the invite code
  update public.loop_designer_invite_codes
  set used_count = used_count + 1,
      is_active = case when max_uses > 0 and used_count + 1 >= max_uses then false else is_active end
  where id = v_invite.id;

  -- Step 5: Create or reactivate member record
  if v_existing_member.id is not null then
    update public.loop_designer_enterprise_members
    set is_active = true, left_at = null
    where id = v_existing_member.id;
  else
    insert into public.loop_designer_enterprise_members (enterprise_id, user_id, role, is_active)
    values (v_invite.enterprise_id, p_user_id, 'member', true);
  end if;

  -- Step 6: Update user's enterprise_id
  update public.loop_designer_users
  set enterprise_id = v_invite.enterprise_id
  where id = p_user_id;

  -- Step 7: Increment target enterprise seats
  update public.loop_designer_enterprises
  set used_seats = used_seats + 1,
      updated_at = now()
  where id = v_invite.enterprise_id;

  -- Step 8: Release old enterprise seats
  if v_old_enterprise_id is not null and v_old_enterprise_id != v_invite.enterprise_id then
    update public.loop_designer_enterprises
    set used_seats = greatest(used_seats - 1, 0),
        updated_at = now()
    where id = v_old_enterprise_id
      and used_seats > 0;
  end if;

  -- Step 9: Audit log
  insert into public.loop_designer_audit_logs (enterprise_id, user_id, action, resource_type, resource_id, details)
  values (v_invite.enterprise_id, p_user_id, 'member_joined_via_invite', 'enterprise',
          v_invite.enterprise_id,
          jsonb_build_object('old_enterprise_id', v_old_enterprise_id, 'code', p_invite_code));

  return jsonb_build_object(
    'success', true,
    'enterprise_id', v_invite.enterprise_id,
    'enterprise_name', v_invite.company_name
  );
end;
$$ language plpgsql security definer;

grant execute on function public.join_enterprise_atomic(text, uuid) to service_role;

-- 2. Atomic create-app-session
-- Creates/activates enterprise, updates user, increments seats, creates auth session.
create or replace function public.create_app_session_atomic(
  p_user_id uuid,
  p_tenant_key text,
  p_company_name text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns jsonb as $$
declare
  v_enterprise_id uuid;
  v_user_enterprise uuid;
  v_has_active_member boolean;
begin
  -- Step 1: Check if user exists and is active
  select enterprise_id into v_user_enterprise
  from public.loop_designer_users
  where id = p_user_id
    and status = 'active';

  if not found then
    return jsonb_build_object('success', false, 'error', '用户不存在或已被禁用');
  end if;

  -- Step 2: Get or create enterprise
  select id into v_enterprise_id
  from public.loop_designer_enterprises
  where tenant_key = p_tenant_key;

  if not found then
    insert into public.loop_designer_enterprises (tenant_key, company_name, is_active)
    values (p_tenant_key, p_company_name, true)
    returning id into v_enterprise_id;

    -- Auto-create member as super_admin for the first user
    insert into public.loop_designer_enterprise_members (enterprise_id, user_id, role, is_active)
    values (v_enterprise_id, p_user_id, 'super_admin', true);

    -- Auto-create default settings
    insert into public.loop_designer_enterprise_settings (enterprise_id)
    values (v_enterprise_id)
    on conflict (enterprise_id) do nothing;
  else
    -- Check if user already has an active member record
    select exists(
      select 1 from public.loop_designer_enterprise_members
      where enterprise_id = v_enterprise_id and user_id = p_user_id and is_active = true
    ) into v_has_active_member;

    if not v_has_active_member then
      insert into public.loop_designer_enterprise_members (enterprise_id, user_id, role, is_active)
      values (v_enterprise_id, p_user_id, 'member', true)
      on conflict (enterprise_id, user_id)
      do update set is_active = true, left_at = null;
    end if;
  end if;

  -- Step 3: Update user's enterprise_id (only if not already set)
  if v_user_enterprise is null then
    update public.loop_designer_users
    set enterprise_id = v_enterprise_id
    where id = p_user_id;
  end if;

  -- Step 4: Increment used seats (only if this is a new active membership)
  if not v_has_active_member or v_user_enterprise is null then
    update public.loop_designer_enterprises
    set used_seats = used_seats + 1,
        updated_at = now()
    where id = v_enterprise_id;
  end if;

  -- Step 5: Create auth session
  insert into public.loop_designer_auth_sessions (user_id, token_hash, expires_at)
  values (p_user_id, p_token_hash, p_expires_at);

  return jsonb_build_object(
    'success', true,
    'enterprise_id', v_enterprise_id
  );
end;
$$ language plpgsql security definer;

grant execute on function public.create_app_session_atomic(uuid, text, text, text, timestamptz) to service_role;
