-- Run after:
-- 1) migration 202604140001_phase1_foundation.sql
-- 2) migration 202604140002_business_modules.sql
-- 3) migration 202604140003_profile_read_collaboration.sql
-- 4) seed_demo_accounts.sql

with users as (
  select
    (select id from public.profiles where lower(email) = 'admin@bcs-demo.id' limit 1) as admin_id,
    (select id from public.profiles where lower(email) = 'bd@bcs-demo.id' limit 1) as bd_id,
    (select id from public.profiles where lower(email) = 'pm@bcs-demo.id' limit 1) as pm_id
)
insert into public.leads (
  lead_code,
  company_name,
  contact_person,
  contact_phone,
  contact_email,
  industry,
  region,
  city,
  source,
  intent_level,
  estimated_value,
  status,
  assigned_bd_id,
  created_by,
  updated_by
)
select *
from (
  select
    'LD-DEMO-001'::text,
    'PT Nusantara Auto Care'::text,
    'Budi Hartono'::text,
    '+62-812-0000-001'::text,
    'budi@nusantara-auto.id'::text,
    'Independent Workshop'::text,
    'West Java'::text,
    'Bandung'::text,
    'Cold Visit'::text,
    5,
    650000000::numeric,
    'SIGNED'::public.lead_status,
    u.bd_id,
    u.admin_id,
    u.admin_id
  from users u
  union all
  select
    'LD-DEMO-002'::text,
    'CV Mitra Servis Mandiri'::text,
    'Rina Wulandari'::text,
    '+62-813-0000-002'::text,
    'rina@mitraservis.id'::text,
    'Fleet Service'::text,
    'DKI Jakarta'::text,
    'Jakarta'::text,
    'Referral'::text,
    4,
    420000000::numeric,
    'FOLLOWING'::public.lead_status,
    u.bd_id,
    u.admin_id,
    u.admin_id
  from users u
  union all
  select
    'LD-DEMO-003'::text,
    'PT Garuda Motor Prima'::text,
    'Andi Pratama'::text,
    '+62-814-0000-003'::text,
    'andi@garudamotor.id'::text,
    'General Repair'::text,
    'East Java'::text,
    'Surabaya'::text,
    'Event'::text,
    3,
    300000000::numeric,
    'NEGOTIATING'::public.lead_status,
    u.bd_id,
    u.admin_id,
    u.admin_id
  from users u
) dataset
on conflict (lead_code) do update
  set company_name = excluded.company_name,
      status = excluded.status,
      assigned_bd_id = excluded.assigned_bd_id,
      updated_at = timezone('utc', now());

insert into public.lead_followups (lead_id, followup_type, summary, followup_at, next_followup_at, status_snapshot)
select
  l.id,
  'VISIT',
  'Initial site survey completed, owner interested in Bosch branding package.',
  timezone('utc', now()) - interval '8 days',
  timezone('utc', now()) - interval '4 days',
  'FOLLOWING'::public.lead_status
from public.leads l
where l.lead_code = 'LD-DEMO-002'
  and not exists (
    select 1 from public.lead_followups f where f.lead_id = l.id and f.summary ilike '%site survey%'
  );

insert into public.signed_records (
  lead_id,
  contract_no,
  contract_date,
  contract_value,
  contract_currency
)
select
  l.id,
  'CNT-DEMO-001',
  current_date - interval '10 days',
  650000000,
  'IDR'
from public.leads l
where l.lead_code = 'LD-DEMO-001'
on conflict (contract_no) do nothing;

insert into public.onboarding_cases (
  case_no,
  signed_record_id,
  status,
  owner_user_id,
  reviewer_user_id,
  sla_due_at,
  started_at,
  remarks
)
select
  'ONB-DEMO-001',
  s.id,
  'SERVICE_ACTIVATING'::public.onboarding_status,
  u.bd_id,
  u.pm_id,
  timezone('utc', now()) + interval '5 days',
  timezone('utc', now()) - interval '6 days',
  'Demo onboarding in activation stage'
from public.signed_records s
cross join (
  select
    (select id from public.profiles where lower(email) = 'admin@bcs-demo.id' limit 1) as admin_id,
    (select id from public.profiles where lower(email) = 'bd@bcs-demo.id' limit 1) as bd_id,
    (select id from public.profiles where lower(email) = 'pm@bcs-demo.id' limit 1) as pm_id
) u
where s.contract_no = 'CNT-DEMO-001'
on conflict (case_no) do update
  set status = excluded.status,
      owner_user_id = excluded.owner_user_id,
      reviewer_user_id = excluded.reviewer_user_id,
      updated_at = timezone('utc', now());

insert into public.onboarding_steps (
  onboarding_case_id,
  step_code,
  step_name,
  step_order,
  status,
  assignee_id,
  due_at
)
select
  c.id,
  step_code,
  step_name,
  step_order,
  step_status,
  assignee_id,
  timezone('utc', now()) + (step_order || ' days')::interval
from (
  values
    ('SYNC_SIGNED_INFO', 'Signed Info Synced', 10, 'COMPLETED'::public.step_status),
    ('DOC_COLLECTION', 'Document Collection', 20, 'COMPLETED'::public.step_status),
    ('COMPLIANCE_REVIEW', 'Compliance Review', 30, 'COMPLETED'::public.step_status),
    ('SERVICE_ACTIVATION', 'Service Activation', 40, 'IN_PROGRESS'::public.step_status)
) as steps(step_code, step_name, step_order, step_status)
join public.onboarding_cases c on c.case_no = 'ONB-DEMO-001'
cross join lateral (
  select
    case
      when step_code in ('SYNC_SIGNED_INFO', 'DOC_COLLECTION') then c.owner_user_id
      else c.reviewer_user_id
    end as assignee_id
) assign
where not exists (
  select 1
  from public.onboarding_steps os
  where os.onboarding_case_id = c.id
    and os.step_code = steps.step_code
);

insert into public.projects (
  project_code,
  onboarding_case_id,
  signed_record_id,
  lead_id,
  name,
  description,
  status,
  pm_owner_id,
  bd_owner_id,
  start_date,
  target_end_date,
  completion_rate
)
select
  'PRJ-DEMO-001',
  c.id,
  c.signed_record_id,
  s.lead_id,
  'Nusantara Auto Care BCS Rollout',
  'Store preparation, equipment setup, staff training, and launch support.',
  'IN_PROGRESS'::public.project_status,
  u.pm_id,
  u.bd_id,
  current_date - interval '7 days',
  current_date + interval '21 days',
  55
from public.onboarding_cases c
join public.signed_records s on s.id = c.signed_record_id
cross join (
  select
    (select id from public.profiles where lower(email) = 'admin@bcs-demo.id' limit 1) as admin_id,
    (select id from public.profiles where lower(email) = 'bd@bcs-demo.id' limit 1) as bd_id,
    (select id from public.profiles where lower(email) = 'pm@bcs-demo.id' limit 1) as pm_id
) u
where c.case_no = 'ONB-DEMO-001'
on conflict (project_code) do update
  set status = excluded.status,
      pm_owner_id = excluded.pm_owner_id,
      bd_owner_id = excluded.bd_owner_id,
      completion_rate = excluded.completion_rate,
      updated_at = timezone('utc', now());

insert into public.project_members (project_id, user_id, role_in_project, is_active)
select p.id, u.pm_id, 'Project Manager', true
from public.projects p
cross join (
  select
    (select id from public.profiles where lower(email) = 'admin@bcs-demo.id' limit 1) as admin_id,
    (select id from public.profiles where lower(email) = 'bd@bcs-demo.id' limit 1) as bd_id,
    (select id from public.profiles where lower(email) = 'pm@bcs-demo.id' limit 1) as pm_id
) u
where p.project_code = 'PRJ-DEMO-001'
on conflict (project_id, user_id) do update
  set is_active = true,
      left_at = null;

insert into public.project_members (project_id, user_id, role_in_project, is_active)
select p.id, u.bd_id, 'BD Liaison', true
from public.projects p
cross join (
  select
    (select id from public.profiles where lower(email) = 'admin@bcs-demo.id' limit 1) as admin_id,
    (select id from public.profiles where lower(email) = 'bd@bcs-demo.id' limit 1) as bd_id,
    (select id from public.profiles where lower(email) = 'pm@bcs-demo.id' limit 1) as pm_id
) u
where p.project_code = 'PRJ-DEMO-001'
on conflict (project_id, user_id) do update
  set is_active = true,
      left_at = null;

insert into public.project_tasks (
  project_id,
  title,
  description,
  status,
  priority,
  assignee_id,
  start_date,
  due_date,
  progress
)
select
  p.id,
  task_title,
  task_desc,
  task_status,
  task_priority,
  task_assignee,
  current_date - interval '5 days',
  current_date + due_offset,
  task_progress
from (
  values
    ('Store layout finalization', 'Finalize VI and zone layout', 'DONE'::public.task_status, 'HIGH'::public.task_priority, 100::numeric, interval '2 days'),
    ('Equipment procurement', 'Confirm and dispatch required equipment set', 'IN_PROGRESS'::public.task_status, 'HIGH'::public.task_priority, 60::numeric, interval '6 days'),
    ('Technician onboarding training', 'Run technical + service SOP training batch', 'TODO'::public.task_status, 'MEDIUM'::public.task_priority, 0::numeric, interval '10 days')
) as t(task_title, task_desc, task_status, task_priority, task_progress, due_offset)
join public.projects p on p.project_code = 'PRJ-DEMO-001'
cross join (
  select
    (select id from public.profiles where lower(email) = 'admin@bcs-demo.id' limit 1) as admin_id,
    (select id from public.profiles where lower(email) = 'bd@bcs-demo.id' limit 1) as bd_id,
    (select id from public.profiles where lower(email) = 'pm@bcs-demo.id' limit 1) as pm_id
) u
cross join lateral (
  select case when t.task_title = 'Technician onboarding training' then u.bd_id else u.pm_id end as task_assignee
) assignee
where not exists (
  select 1
  from public.project_tasks pt
  where pt.project_id = p.id
    and pt.title = t.task_title
    and pt.deleted_at is null
);

insert into public.project_updates (project_id, summary, shared_with_bd)
select p.id, 'Site readiness reached 55%; equipment procurement is on schedule.', true
from public.projects p
where p.project_code = 'PRJ-DEMO-001'
  and not exists (
    select 1 from public.project_updates u where u.project_id = p.id and u.summary ilike '%Site readiness reached 55%%'
  );

with target_users as (
  select id
  from public.profiles
  where lower(email) in ('admin@bcs-demo.id', 'bd@bcs-demo.id', 'pm@bcs-demo.id')
)
insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
select
  t.id,
  'demo_data',
  'Demo business data loaded',
  'Lead, onboarding, and project demo records are now available for walkthrough.',
  'system',
  'demo-seed'
from target_users t
on conflict do nothing;
