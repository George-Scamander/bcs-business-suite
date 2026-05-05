-- Final repair: enforce a single predictable INSERT policy for leads.

-- Ensure bd_user / project_manager keep required lead permissions.
insert into public.role_permission_relations (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('leads.read', 'leads.write')
where r.code in ('bd_user', 'project_manager')
on conflict do nothing;

insert into public.role_permission_relations (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'leads.import'
where r.code = 'project_manager'
on conflict do nothing;

-- Remove any historical/duplicate INSERT policies that might still intercept requests.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'leads'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.leads', p.policyname);
  end loop;
end
$$;

create policy leads_insert_policy
on public.leads
for insert to authenticated
with check (
  auth.uid() is not null
  and public.has_permission('leads.write', auth.uid())
  and coalesce(created_by, auth.uid()) = auth.uid()
  and coalesce(updated_by, auth.uid()) = auth.uid()
  and (
    assigned_bd_id is null
    or assigned_bd_id = auth.uid()
    or public.is_super_admin(auth.uid())
  )
);

create or replace function public.fill_lead_audit_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if new.updated_by is null then
    new.updated_by := auth.uid();
  end if;

  if new.assigned_bd_id is null and not public.is_super_admin(auth.uid()) then
    new.assigned_bd_id := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leads_fill_audit_defaults on public.leads;
create trigger trg_leads_fill_audit_defaults
before insert on public.leads
for each row
execute function public.fill_lead_audit_defaults();
