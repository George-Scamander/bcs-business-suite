-- Durable fix: restore soft-deleted leads/projects via SECURITY DEFINER RPCs.
-- This avoids RLS update-policy conflicts that can block restore operations.

create or replace function public.restore_deleted_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.deleted_at is not null
      and (
        public.is_super_admin(v_user_id)
        or (
          public.has_permission('projects.write', v_user_id)
          and (p.pm_owner_id = v_user_id or p.bd_owner_id = v_user_id)
        )
      )
  ) then
    raise exception 'Project restore not allowed or record not found';
  end if;

  update public.projects
  set deleted_at = null,
      updated_by = v_user_id,
      updated_at = timezone('utc', now())
  where id = p_project_id;
end;
$$;

create or replace function public.restore_deleted_projects_bulk(p_project_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_project_ids is null or array_length(p_project_ids, 1) is null then
    return 0;
  end if;

  update public.projects p
  set deleted_at = null,
      updated_by = v_user_id,
      updated_at = timezone('utc', now())
  where p.id = any (p_project_ids)
    and p.deleted_at is not null
    and (
      public.is_super_admin(v_user_id)
      or (
        public.has_permission('projects.write', v_user_id)
        and (p.pm_owner_id = v_user_id or p.bd_owner_id = v_user_id)
      )
    );

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

create or replace function public.restore_deleted_lead(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.leads l
    where l.id = p_lead_id
      and l.deleted_at is not null
      and (
        public.is_super_admin(v_user_id)
        or (
          public.has_permission('leads.write', v_user_id)
          and (l.created_by = v_user_id or l.assigned_bd_id = v_user_id)
        )
      )
  ) then
    raise exception 'Lead restore not allowed or record not found';
  end if;

  update public.leads
  set deleted_at = null,
      updated_by = v_user_id,
      updated_at = timezone('utc', now())
  where id = p_lead_id;
end;
$$;

create or replace function public.restore_deleted_leads_bulk(p_lead_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_lead_ids is null or array_length(p_lead_ids, 1) is null then
    return 0;
  end if;

  update public.leads l
  set deleted_at = null,
      updated_by = v_user_id,
      updated_at = timezone('utc', now())
  where l.id = any (p_lead_ids)
    and l.deleted_at is not null
    and (
      public.is_super_admin(v_user_id)
      or (
        public.has_permission('leads.write', v_user_id)
        and (l.created_by = v_user_id or l.assigned_bd_id = v_user_id)
      )
    );

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

grant execute on function public.restore_deleted_project(uuid) to authenticated;
grant execute on function public.restore_deleted_projects_bulk(uuid[]) to authenticated;
grant execute on function public.restore_deleted_lead(uuid) to authenticated;
grant execute on function public.restore_deleted_leads_bulk(uuid[]) to authenticated;
