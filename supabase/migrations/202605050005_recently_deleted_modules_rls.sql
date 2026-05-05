-- Recently deleted modules support for BD leads and PM projects.

-- Allow selecting deleted leads for owners/admins.
DROP POLICY IF EXISTS leads_select_deleted_policy ON public.leads;
create policy leads_select_deleted_policy
on public.leads
for select to authenticated
using (
  deleted_at is not null
  and (
    public.is_super_admin(auth.uid())
    or (
      public.has_permission('leads.read', auth.uid())
      and (created_by = auth.uid() or assigned_bd_id = auth.uid())
    )
  )
);

-- Allow permanent delete only after soft-delete, by owner/admin.
DROP POLICY IF EXISTS leads_delete_policy ON public.leads;
create policy leads_delete_policy
on public.leads
for delete to authenticated
using (
  public.is_super_admin(auth.uid())
  or (
    deleted_at is not null
    and public.has_permission('leads.write', auth.uid())
    and (created_by = auth.uid() or assigned_bd_id = auth.uid())
  )
);

-- Allow selecting deleted projects for owners/admins.
DROP POLICY IF EXISTS projects_select_deleted_policy ON public.projects;
create policy projects_select_deleted_policy
on public.projects
for select to authenticated
using (
  deleted_at is not null
  and (
    public.is_super_admin(auth.uid())
    or (
      public.has_permission('projects.read', auth.uid())
      and (pm_owner_id = auth.uid() or bd_owner_id = auth.uid())
    )
  )
);

-- Allow permanent delete only after soft-delete, by owner/admin.
DROP POLICY IF EXISTS projects_delete_policy ON public.projects;
create policy projects_delete_policy
on public.projects
for delete to authenticated
using (
  public.is_super_admin(auth.uid())
  or (
    deleted_at is not null
    and public.has_permission('projects.write', auth.uid())
    and (pm_owner_id = auth.uid() or bd_owner_id = auth.uid())
  )
);
