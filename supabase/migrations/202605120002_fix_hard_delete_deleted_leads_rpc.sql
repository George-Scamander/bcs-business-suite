-- Use SECURITY DEFINER RPC for permanent lead deletion so all ports share the same
-- permission gate and avoid direct-RLS delete inconsistencies.

create or replace function public.hard_delete_deleted_lead(p_lead_id uuid)
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
        or public.has_role_code('project_manager', v_user_id)
        or (
          public.has_permission('leads.write', v_user_id)
          and (l.created_by = v_user_id or l.assigned_bd_id = v_user_id)
        )
      )
  ) then
    raise exception 'Lead permanent delete not allowed or record not found';
  end if;

  delete from public.leads
  where id = p_lead_id
    and deleted_at is not null;
end;
$$;

create or replace function public.hard_delete_deleted_leads_bulk(p_lead_ids uuid[])
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

  delete from public.leads l
  where l.id = any (p_lead_ids)
    and l.deleted_at is not null
    and (
      public.is_super_admin(v_user_id)
      or public.has_role_code('project_manager', v_user_id)
      or (
        public.has_permission('leads.write', v_user_id)
        and (l.created_by = v_user_id or l.assigned_bd_id = v_user_id)
      )
    );

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

grant execute on function public.hard_delete_deleted_lead(uuid) to authenticated;
grant execute on function public.hard_delete_deleted_leads_bulk(uuid[]) to authenticated;
