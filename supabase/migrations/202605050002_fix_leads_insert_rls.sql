-- Fix: lead creation blocked by RLS for some BD users.

-- Ensure BD role keeps lead read/write permissions.
insert into public.role_permission_relations (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('leads.read', 'leads.write')
where r.code = 'bd_user'
on conflict do nothing;

-- Make insert policy resilient when created_by is omitted by client payload.
DROP POLICY IF EXISTS leads_insert_policy ON public.leads;
create policy leads_insert_policy
on public.leads
for insert to authenticated
with check (
  public.has_permission('leads.write', auth.uid())
  and (
    coalesce(created_by, auth.uid()) = auth.uid()
    or public.is_super_admin(auth.uid())
  )
);

-- Force audit columns on insert if they are empty.
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

  return new;
end;
$$;

drop trigger if exists trg_leads_fill_audit_defaults on public.leads;
create trigger trg_leads_fill_audit_defaults
before insert on public.leads
for each row
execute function public.fill_lead_audit_defaults();
