-- Direct fix for BD lead creation blocked by RLS.
-- Allow authenticated BD users to insert leads assigned to themselves.

DROP POLICY IF EXISTS leads_insert_policy ON public.leads;

create policy leads_insert_policy
on public.leads
for insert to authenticated
with check (
  auth.uid() is not null
  and (
    public.is_super_admin(auth.uid())
    or exists (
      select 1
      from public.user_role_relations urr
      join public.roles r on r.id = urr.role_id
      where urr.user_id = auth.uid()
        and r.code = 'bd_user'
    )
  )
  and coalesce(created_by, auth.uid()) = auth.uid()
  and (
    assigned_bd_id is null
    or assigned_bd_id = auth.uid()
    or public.is_super_admin(auth.uid())
  )
);
