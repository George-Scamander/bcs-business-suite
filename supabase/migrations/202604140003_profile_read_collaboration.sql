begin;

drop policy if exists profiles_select_self_or_admin on public.profiles;

create policy profiles_select_collaboration_access
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.is_super_admin(auth.uid())
  or public.has_permission('users.read', auth.uid())
  or public.has_permission('leads.write', auth.uid())
  or public.has_permission('onboarding.read', auth.uid())
  or public.has_permission('projects.write', auth.uid())
  or public.has_permission('projects.member.manage', auth.uid())
);

commit;
