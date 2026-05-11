-- Align PM lead-pool capabilities with BD/Admin unified lead management.
-- 1) PM can access all leads in shared lead pool view.
-- 2) PM gets the same lead operation permissions needed by unified actions.

create or replace function public.can_access_lead(p_lead_id uuid, p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  if public.is_super_admin(p_user_id) then
    return true;
  end if;

  if public.has_role_code('project_manager', p_user_id) then
    return true;
  end if;

  if exists (
    select 1
    from public.leads l
    where l.id = p_lead_id
      and l.deleted_at is null
      and (
        l.assigned_bd_id = p_user_id
        or l.created_by = p_user_id
      )
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.projects p
    where p.lead_id = p_lead_id
      and p.deleted_at is null
      and (
        p.pm_owner_id = p_user_id
        or p.bd_owner_id = p_user_id
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = p_user_id
            and pm.is_active = true
        )
      )
  ) then
    return true;
  end if;

  return false;
end;
$$;

insert into public.role_permission_relations (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'leads.assign',
  'leads.status.change',
  'contracts.write',
  'onboarding.write'
)
where r.code = 'project_manager'
on conflict do nothing;
