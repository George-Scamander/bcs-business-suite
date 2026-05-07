-- Fix: ensure deleted rows are queryable and restorable under RLS.
-- Without these policies, UPDATE may match 0 rows silently for deleted records.

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

DROP POLICY IF EXISTS leads_restore_deleted_policy ON public.leads;
create policy leads_restore_deleted_policy
on public.leads
for update to authenticated
using (
  deleted_at is not null
  and (
    public.is_super_admin(auth.uid())
    or (
      public.has_permission('leads.write', auth.uid())
      and (created_by = auth.uid() or assigned_bd_id = auth.uid())
    )
  )
)
with check (
  deleted_at is null
  and (
    public.is_super_admin(auth.uid())
    or (
      public.has_permission('leads.write', auth.uid())
      and (created_by = auth.uid() or assigned_bd_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS projects_restore_deleted_policy ON public.projects;
create policy projects_restore_deleted_policy
on public.projects
for update to authenticated
using (
  deleted_at is not null
  and (
    public.is_super_admin(auth.uid())
    or (
      public.has_permission('projects.write', auth.uid())
      and (pm_owner_id = auth.uid() or bd_owner_id = auth.uid())
    )
  )
)
with check (
  deleted_at is null
  and (
    public.is_super_admin(auth.uid())
    or (
      public.has_permission('projects.write', auth.uid())
      and (pm_owner_id = auth.uid() or bd_owner_id = auth.uid())
    )
  )
);
