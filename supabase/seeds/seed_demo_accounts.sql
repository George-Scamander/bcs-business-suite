-- Run this script after creating users in Supabase Auth dashboard.
-- Recommended demo users:
-- 1) admin@bcs-demo.id
-- 2) bd@bcs-demo.id
-- 3) pm@bcs-demo.id

select public.assign_role_by_email('admin@bcs-demo.id', 'super_admin');
select public.assign_role_by_email('bd@bcs-demo.id', 'bd_user');
select public.assign_role_by_email('pm@bcs-demo.id', 'project_manager');

with target_users as (
  select id, email
  from public.profiles
  where lower(email) in ('admin@bcs-demo.id', 'bd@bcs-demo.id', 'pm@bcs-demo.id')
)
insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
select
  tu.id,
  'system_bootstrap',
  'BCS MVP environment initialized',
  'Your account is ready. Continue with Lead -> Onboarding -> Project workflow walkthrough.',
  'system',
  'mvp-init'
from target_users tu
on conflict do nothing;
