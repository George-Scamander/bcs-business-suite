begin;

-- BD read-only department lead overview:
-- includes BD-created leads, imported/admin-created leads, and any lead assigned to BD.

create or replace function public.list_department_leads_for_bd(
  p_keyword text default null,
  p_status public.lead_status default null,
  p_region text default null,
  p_industry text default null,
  p_intent_package text default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null
)
returns table (
  id uuid,
  lead_code text,
  company_name text,
  status public.lead_status,
  contact_person text,
  contact_phone text,
  contact_email text,
  industry text,
  region text,
  city text,
  address text,
  source text,
  intent_package text,
  intent_level integer,
  assigned_bd_id uuid,
  assigned_bd_name text,
  assigned_bd_email text,
  created_by uuid,
  created_by_name text,
  created_by_email text,
  next_followup_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    public.is_super_admin(v_user_id)
    or public.has_role_code('project_manager', v_user_id)
    or public.has_role_code('bd_user', v_user_id)
  ) then
    raise exception 'Permission denied';
  end if;

  return query
  select
    l.id,
    l.lead_code,
    l.company_name,
    l.status,
    l.contact_person,
    l.contact_phone,
    l.contact_email,
    l.industry,
    l.region,
    l.city,
    l.address,
    l.source,
    l.intent_package,
    l.intent_level,
    l.assigned_bd_id,
    ap.full_name as assigned_bd_name,
    ap.email as assigned_bd_email,
    l.created_by,
    cp.full_name as created_by_name,
    cp.email as created_by_email,
    l.next_followup_at,
    l.created_at,
    l.updated_at
  from public.leads l
  left join public.profiles ap on ap.id = l.assigned_bd_id
  left join public.profiles cp on cp.id = l.created_by
  where l.deleted_at is null
    and (
      l.assigned_bd_id is not null
      or exists (
        select 1
        from public.user_role_relations urr
        join public.roles r on r.id = urr.role_id
        where urr.user_id = l.created_by
          and r.code = 'project_manager'
      )
      or exists (
        select 1
        from public.user_role_relations urr
        join public.roles r on r.id = urr.role_id
        where urr.user_id = l.created_by
          and r.code = 'super_admin'
      )
      or exists (
        select 1
        from public.user_role_relations urr
        join public.roles r on r.id = urr.role_id
        where urr.user_id = l.created_by
          and r.code = 'bd_user'
      )
    )
    and (p_status is null or l.status = p_status)
    and (p_intent_package is null or l.intent_package = p_intent_package)
    and (
      p_region is null
      or btrim(p_region) = ''
      or l.region ilike ('%' || btrim(p_region) || '%')
    )
    and (
      p_industry is null
      or btrim(p_industry) = ''
      or l.industry ilike ('%' || btrim(p_industry) || '%')
    )
    and (p_created_from is null or l.created_at >= p_created_from)
    and (p_created_to is null or l.created_at <= p_created_to)
    and (
      p_keyword is null
      or btrim(p_keyword) = ''
      or l.lead_code ilike ('%' || btrim(p_keyword) || '%')
      or l.company_name ilike ('%' || btrim(p_keyword) || '%')
      or coalesce(l.contact_person, '') ilike ('%' || btrim(p_keyword) || '%')
      or coalesce(l.source, '') ilike ('%' || btrim(p_keyword) || '%')
    )
  order by l.updated_at desc;
end;
$$;

grant execute on function public.list_department_leads_for_bd(text, public.lead_status, text, text, text, timestamptz, timestamptz)
to authenticated;

commit;
