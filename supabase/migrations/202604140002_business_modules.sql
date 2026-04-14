begin;

-- =====================================
-- Enums
-- =====================================
DO $$
BEGIN
  CREATE TYPE public.lead_status AS ENUM (
    'NEW',
    'TO_FOLLOW',
    'FOLLOWING',
    'NEGOTIATING',
    'ON_HOLD',
    'LOST',
    'SIGNED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.onboarding_status AS ENUM (
    'NOT_STARTED',
    'INFO_PENDING',
    'DOCUMENT_PENDING',
    'UNDER_REVIEW',
    'REVISION_REQUIRED',
    'CONTRACT_CONFIRMED',
    'SERVICE_ACTIVATING',
    'COMPLETED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.project_status AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'ON_HOLD',
    'DELAYED',
    'COMPLETED',
    'CLOSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.step_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'REVISION_REQUIRED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.task_status AS ENUM (
    'TODO',
    'IN_PROGRESS',
    'ON_HOLD',
    'DONE',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.task_priority AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.review_decision AS ENUM (
    'APPROVED',
    'REJECTED',
    'REVISION_REQUIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================
-- Tables
-- =====================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_code text not null unique default ('LD-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6))),
  company_name text not null,
  contact_person text,
  contact_phone text,
  contact_email text,
  industry text,
  region text,
  city text,
  address text,
  source text,
  intent_level integer check (intent_level between 1 and 5),
  estimated_value numeric(14, 2),
  status public.lead_status not null default 'NEW',
  lost_reason_code text,
  lost_reason_note text,
  status_reason text,
  assigned_bd_id uuid references public.profiles (id) on delete set null,
  next_followup_at timestamptz,
  last_followup_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  followup_type text not null,
  summary text not null,
  followup_at timestamptz not null default timezone('utc', now()),
  next_followup_at timestamptz,
  status_snapshot public.lead_status,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_attachments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  file_record_id uuid references public.app_uploaded_files (id) on delete set null,
  file_name text not null,
  object_path text,
  uploaded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  uploaded_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_assignment_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  from_user_id uuid references public.profiles (id) on delete set null,
  to_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  reason text,
  assigned_by uuid references public.profiles (id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_status_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  from_status public.lead_status,
  to_status public.lead_status not null,
  reason text,
  lost_reason_code text,
  changed_by uuid references public.profiles (id) on delete set null default auth.uid(),
  changed_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.signed_records (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads (id) on delete cascade,
  contract_no text not null unique,
  contract_date date,
  contract_value numeric(14, 2),
  contract_currency text not null default 'IDR',
  contract_file_id uuid references public.app_uploaded_files (id) on delete set null,
  signed_by uuid references public.profiles (id) on delete set null default auth.uid(),
  signed_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.onboarding_cases (
  id uuid primary key default gen_random_uuid(),
  case_no text not null unique default ('ONB-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6))),
  signed_record_id uuid not null unique references public.signed_records (id) on delete cascade,
  status public.onboarding_status not null default 'NOT_STARTED',
  owner_user_id uuid references public.profiles (id) on delete set null,
  reviewer_user_id uuid references public.profiles (id) on delete set null,
  sla_due_at timestamptz,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  rejected_at timestamptz,
  remarks text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  onboarding_case_id uuid not null references public.onboarding_cases (id) on delete cascade,
  step_code text not null,
  step_name text not null,
  step_order integer not null,
  status public.step_status not null default 'PENDING',
  assignee_id uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  remarks text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (onboarding_case_id, step_code)
);

create table if not exists public.onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  onboarding_case_id uuid not null references public.onboarding_cases (id) on delete cascade,
  doc_type text not null,
  file_record_id uuid references public.app_uploaded_files (id) on delete set null,
  file_name text,
  object_path text,
  version_no integer not null default 1,
  is_latest boolean not null default true,
  submitted_by uuid references public.profiles (id) on delete set null default auth.uid(),
  submitted_at timestamptz not null default timezone('utc', now()),
  review_status text not null default 'PENDING',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_comment text
);

create table if not exists public.onboarding_reviews (
  id uuid primary key default gen_random_uuid(),
  onboarding_case_id uuid not null references public.onboarding_cases (id) on delete cascade,
  document_id uuid references public.onboarding_documents (id) on delete set null,
  decision public.review_decision not null,
  comment text,
  reviewer_id uuid references public.profiles (id) on delete set null default auth.uid(),
  reviewed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.onboarding_status_logs (
  id uuid primary key default gen_random_uuid(),
  onboarding_case_id uuid not null references public.onboarding_cases (id) on delete cascade,
  from_status public.onboarding_status,
  to_status public.onboarding_status not null,
  reason text,
  changed_by uuid references public.profiles (id) on delete set null default auth.uid(),
  changed_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique default ('PRJ-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6))),
  onboarding_case_id uuid not null unique references public.onboarding_cases (id) on delete cascade,
  signed_record_id uuid references public.signed_records (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  name text not null,
  description text,
  status public.project_status not null default 'NOT_STARTED',
  pm_owner_id uuid references public.profiles (id) on delete set null,
  bd_owner_id uuid references public.profiles (id) on delete set null,
  start_date date,
  target_end_date date,
  actual_end_date date,
  completion_rate numeric(5,2) not null default 0,
  is_delayed boolean not null default false,
  delay_reason text,
  closed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint projects_completion_rate_range check (completion_rate >= 0 and completion_rate <= 100)
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_in_project text not null,
  is_active boolean not null default true,
  joined_at timestamptz not null default timezone('utc', now()),
  left_at timestamptz,
  unique (project_id, user_id)
);

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  planned_date date,
  actual_date date,
  owner_id uuid references public.profiles (id) on delete set null,
  status public.task_status not null default 'TODO',
  progress numeric(5,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_milestones_progress_range check (progress >= 0 and progress <= 100)
);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid references public.project_milestones (id) on delete set null,
  title text not null,
  description text,
  status public.task_status not null default 'TODO',
  priority public.task_priority not null default 'MEDIUM',
  assignee_id uuid references public.profiles (id) on delete set null,
  start_date date,
  due_date date,
  completed_at timestamptz,
  progress numeric(5,2) not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint project_tasks_progress_range check (progress >= 0 and progress <= 100)
);

create table if not exists public.project_status_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  from_status public.project_status,
  to_status public.project_status not null,
  reason text,
  changed_by uuid references public.profiles (id) on delete set null default auth.uid(),
  changed_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  summary text not null,
  detail jsonb,
  shared_with_bd boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  filters jsonb,
  status text not null default 'PENDING',
  requested_by uuid references public.profiles (id) on delete set null default auth.uid(),
  file_record_id uuid references public.app_uploaded_files (id) on delete set null,
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

-- =====================================
-- Indexes
-- =====================================
create index if not exists idx_leads_status_assignee_followup on public.leads (status, assigned_bd_id, next_followup_at);
create index if not exists idx_leads_region_status on public.leads (region, status);
create index if not exists idx_lead_followups_lead_date on public.lead_followups (lead_id, followup_at desc);
create index if not exists idx_signed_records_lead on public.signed_records (lead_id);
create index if not exists idx_onboarding_cases_status_owner_sla on public.onboarding_cases (status, owner_user_id, sla_due_at);
create index if not exists idx_onboarding_documents_case_type on public.onboarding_documents (onboarding_case_id, doc_type, is_latest);
create index if not exists idx_projects_status_owner_target on public.projects (status, pm_owner_id, target_end_date);
create index if not exists idx_project_tasks_project_status_due on public.project_tasks (project_id, status, due_date);
create index if not exists idx_project_milestones_project on public.project_milestones (project_id, planned_date);
create index if not exists idx_project_members_project_user on public.project_members (project_id, user_id);

-- =====================================
-- Triggers for updated_at
-- =====================================
drop trigger if exists trg_leads_set_updated_at on public.leads;
create trigger trg_leads_set_updated_at before update on public.leads
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_signed_records_set_updated_at on public.signed_records;
create trigger trg_signed_records_set_updated_at before update on public.signed_records
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_onboarding_cases_set_updated_at on public.onboarding_cases;
create trigger trg_onboarding_cases_set_updated_at before update on public.onboarding_cases
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_onboarding_steps_set_updated_at on public.onboarding_steps;
create trigger trg_onboarding_steps_set_updated_at before update on public.onboarding_steps
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_projects_set_updated_at on public.projects;
create trigger trg_projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_project_milestones_set_updated_at on public.project_milestones;
create trigger trg_project_milestones_set_updated_at before update on public.project_milestones
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_project_tasks_set_updated_at on public.project_tasks;
create trigger trg_project_tasks_set_updated_at before update on public.project_tasks
for each row execute function public.set_updated_at_timestamp();

-- =====================================
-- Access helper functions
-- =====================================
create or replace function public.can_access_lead(p_lead_id uuid, p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  if public.is_super_admin(p_user_id) then
    return true;
  end if;

  if exists (
    select 1
    from public.leads l
    where l.id = p_lead_id
      and l.deleted_at is null
      and (
        l.assigned_bd_id = p_user_id
        or l.created_by = p_user_id
      )
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.projects p
    where p.lead_id = p_lead_id
      and p.deleted_at is null
      and (
        p.pm_owner_id = p_user_id
        or p.bd_owner_id = p_user_id
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = p_user_id
            and pm.is_active = true
        )
      )
  ) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.can_access_onboarding_case(p_case_id uuid, p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
begin
  if p_user_id is null then
    return false;
  end if;

  if public.is_super_admin(p_user_id) then
    return true;
  end if;

  if exists (
    select 1
    from public.onboarding_cases oc
    where oc.id = p_case_id
      and oc.deleted_at is null
      and (
        oc.owner_user_id = p_user_id
        or oc.reviewer_user_id = p_user_id
        or oc.created_by = p_user_id
      )
  ) then
    return true;
  end if;

  select sr.lead_id
    into v_lead_id
  from public.onboarding_cases oc
  join public.signed_records sr on sr.id = oc.signed_record_id
  where oc.id = p_case_id;

  if v_lead_id is not null and public.can_access_lead(v_lead_id, p_user_id) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.can_access_project(p_project_id uuid, p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  if public.is_super_admin(p_user_id) then
    return true;
  end if;

  if exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.deleted_at is null
      and (
        p.pm_owner_id = p_user_id
        or p.bd_owner_id = p_user_id
      )
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
      and pm.is_active = true
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- =====================================
-- Business orchestration functions
-- =====================================
create or replace function public.create_onboarding_case_from_signed(
  p_signed_record_id uuid,
  p_owner_user_id uuid default null,
  p_reviewer_user_id uuid default null,
  p_sla_days integer default 14
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid;
  v_lead_id uuid;
  v_assigned_bd uuid;
begin
  select oc.id
    into v_case_id
  from public.onboarding_cases oc
  where oc.signed_record_id = p_signed_record_id
  limit 1;

  if v_case_id is not null then
    return v_case_id;
  end if;

  select sr.lead_id, l.assigned_bd_id
    into v_lead_id, v_assigned_bd
  from public.signed_records sr
  join public.leads l on l.id = sr.lead_id
  where sr.id = p_signed_record_id
  limit 1;

  if v_lead_id is null then
    raise exception 'Signed record not found: %', p_signed_record_id;
  end if;

  insert into public.onboarding_cases (
    signed_record_id,
    status,
    owner_user_id,
    reviewer_user_id,
    sla_due_at,
    created_by,
    updated_by
  )
  values (
    p_signed_record_id,
    'INFO_PENDING',
    coalesce(p_owner_user_id, v_assigned_bd),
    p_reviewer_user_id,
    timezone('utc', now()) + make_interval(days => p_sla_days),
    coalesce(auth.uid(), v_assigned_bd),
    coalesce(auth.uid(), v_assigned_bd)
  )
  returning id into v_case_id;

  insert into public.onboarding_steps (
    onboarding_case_id,
    step_code,
    step_name,
    step_order,
    status,
    assignee_id,
    due_at
  )
  values
    (v_case_id, 'INFO_COLLECTION', 'Business Information Collection', 10, 'IN_PROGRESS', coalesce(p_owner_user_id, v_assigned_bd), timezone('utc', now()) + interval '3 days'),
    (v_case_id, 'DOCUMENT_SUBMISSION', 'Document Submission', 20, 'PENDING', coalesce(p_owner_user_id, v_assigned_bd), timezone('utc', now()) + interval '7 days'),
    (v_case_id, 'COMPLIANCE_REVIEW', 'Compliance Review', 30, 'PENDING', p_reviewer_user_id, timezone('utc', now()) + interval '10 days'),
    (v_case_id, 'CONTRACT_CONFIRMATION', 'Contract Confirmation', 40, 'PENDING', p_reviewer_user_id, timezone('utc', now()) + interval '12 days'),
    (v_case_id, 'SERVICE_ACTIVATION', 'Service Activation', 50, 'PENDING', p_reviewer_user_id, timezone('utc', now()) + interval '14 days'),
    (v_case_id, 'COMPLETION', 'Onboarding Completion', 60, 'PENDING', p_reviewer_user_id, timezone('utc', now()) + interval '14 days');

  insert into public.onboarding_status_logs (onboarding_case_id, from_status, to_status, reason)
  values (v_case_id, null, 'INFO_PENDING', 'Case auto-created from signed lead');

  if coalesce(p_owner_user_id, v_assigned_bd) is not null then
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      coalesce(p_owner_user_id, v_assigned_bd),
      'onboarding_case_created',
      'New onboarding case created',
      'A new onboarding case is waiting for information submission.',
      'onboarding_case',
      v_case_id::text
    );
  end if;

  perform public.record_operation_log(
    'onboarding',
    'onboarding_cases',
    v_case_id::text,
    'create_case',
    null,
    jsonb_build_object('signed_record_id', p_signed_record_id, 'status', 'INFO_PENDING'),
    null
  );

  return v_case_id;
end;
$$;

create or replace function public.create_project_from_onboarding(
  p_onboarding_case_id uuid,
  p_pm_owner_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_signed_record_id uuid;
  v_lead_id uuid;
  v_bd_owner_id uuid;
  v_name text;
begin
  select p.id
    into v_project_id
  from public.projects p
  where p.onboarding_case_id = p_onboarding_case_id
  limit 1;

  if v_project_id is not null then
    return v_project_id;
  end if;

  select oc.signed_record_id, sr.lead_id, l.assigned_bd_id, l.company_name
    into v_signed_record_id, v_lead_id, v_bd_owner_id, v_name
  from public.onboarding_cases oc
  join public.signed_records sr on sr.id = oc.signed_record_id
  join public.leads l on l.id = sr.lead_id
  where oc.id = p_onboarding_case_id
  limit 1;

  if v_lead_id is null then
    raise exception 'Onboarding case not found: %', p_onboarding_case_id;
  end if;

  insert into public.projects (
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
    created_by,
    updated_by
  )
  values (
    p_onboarding_case_id,
    v_signed_record_id,
    v_lead_id,
    coalesce(v_name, 'BCS Project') || ' - Execution',
    'Auto-generated from completed onboarding case',
    'NOT_STARTED',
    p_pm_owner_id,
    v_bd_owner_id,
    current_date,
    current_date + interval '60 days',
    auth.uid(),
    auth.uid()
  )
  returning id into v_project_id;

  insert into public.project_members (project_id, user_id, role_in_project, is_active)
  select v_project_id, p_pm_owner_id, 'PM', true
  where p_pm_owner_id is not null
  on conflict (project_id, user_id) do nothing;

  insert into public.project_members (project_id, user_id, role_in_project, is_active)
  select v_project_id, v_bd_owner_id, 'BD', true
  where v_bd_owner_id is not null
  on conflict (project_id, user_id) do nothing;

  insert into public.project_milestones (project_id, title, description, planned_date, owner_id, status, progress, sort_order)
  values
    (v_project_id, 'Kickoff', 'Project kickoff and alignment', current_date + interval '7 days', p_pm_owner_id, 'TODO', 0, 10),
    (v_project_id, 'Implementation', 'Execution of setup and launch checklist', current_date + interval '35 days', p_pm_owner_id, 'TODO', 0, 20),
    (v_project_id, 'Go-live & Handover', 'Go-live acceptance and closure prep', current_date + interval '60 days', p_pm_owner_id, 'TODO', 0, 30);

  insert into public.project_status_logs (project_id, from_status, to_status, reason)
  values (v_project_id, null, 'NOT_STARTED', 'Project auto-created from onboarding completion');

  if p_pm_owner_id is not null then
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      p_pm_owner_id,
      'project_created',
      'New project assigned',
      'A project has been created from onboarding completion and requires PM ownership.',
      'project',
      v_project_id::text
    );
  end if;

  if v_bd_owner_id is not null then
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      v_bd_owner_id,
      'project_created_for_bd',
      'Project created from your signed lead',
      'A related project is now created and ready for execution handover.',
      'project',
      v_project_id::text
    );
  end if;

  perform public.record_operation_log(
    'projects',
    'projects',
    v_project_id::text,
    'create_project',
    null,
    jsonb_build_object('onboarding_case_id', p_onboarding_case_id, 'status', 'NOT_STARTED'),
    null
  );

  return v_project_id;
end;
$$;

create or replace function public.change_lead_status(
  p_lead_id uuid,
  p_to_status public.lead_status,
  p_reason text default null,
  p_lost_reason_code text default null,
  p_contract_no text default null,
  p_contract_date date default null,
  p_contract_value numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads;
  v_signed_id uuid;
  v_case_id uuid;
begin
  select * into v_lead
  from public.leads
  where id = p_lead_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Lead not found: %', p_lead_id;
  end if;

  if not public.can_access_lead(p_lead_id, auth.uid()) then
    raise exception 'Permission denied for lead: %', p_lead_id;
  end if;

  if v_lead.status = p_to_status then
    return null;
  end if;

  if v_lead.status = 'SIGNED' and p_to_status <> 'SIGNED' then
    raise exception 'Signed lead cannot move back to another status';
  end if;

  if p_to_status = 'LOST' and (p_lost_reason_code is null or length(trim(p_lost_reason_code)) = 0) then
    raise exception 'LOST status requires lost reason code';
  end if;

  if p_to_status = 'SIGNED' and v_lead.status not in ('NEW', 'TO_FOLLOW', 'FOLLOWING', 'NEGOTIATING', 'ON_HOLD') then
    raise exception 'Invalid status transition to SIGNED from %', v_lead.status;
  end if;

  update public.leads
  set
    status = p_to_status,
    status_reason = p_reason,
    lost_reason_code = case when p_to_status = 'LOST' then p_lost_reason_code else null end,
    updated_by = auth.uid(),
    updated_at = timezone('utc', now())
  where id = p_lead_id;

  insert into public.lead_status_logs (lead_id, from_status, to_status, reason, lost_reason_code, changed_by)
  values (p_lead_id, v_lead.status, p_to_status, p_reason, p_lost_reason_code, auth.uid());

  perform public.record_operation_log(
    'leads',
    'leads',
    p_lead_id::text,
    'change_status',
    jsonb_build_object('status', v_lead.status),
    jsonb_build_object('status', p_to_status, 'reason', p_reason, 'lost_reason_code', p_lost_reason_code),
    null
  );

  if p_to_status = 'SIGNED' then
    insert into public.signed_records (
      lead_id,
      contract_no,
      contract_date,
      contract_value,
      signed_by,
      created_by,
      updated_by
    )
    values (
      p_lead_id,
      coalesce(p_contract_no, 'CTR-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6))),
      p_contract_date,
      p_contract_value,
      auth.uid(),
      auth.uid(),
      auth.uid()
    )
    on conflict (lead_id)
    do update set
      contract_date = coalesce(excluded.contract_date, public.signed_records.contract_date),
      contract_value = coalesce(excluded.contract_value, public.signed_records.contract_value),
      updated_by = auth.uid(),
      updated_at = timezone('utc', now())
    returning id into v_signed_id;

    v_case_id := public.create_onboarding_case_from_signed(v_signed_id, v_lead.assigned_bd_id, null, 14);

    if v_lead.assigned_bd_id is not null then
      insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
      values (
        v_lead.assigned_bd_id,
        'lead_signed',
        'Lead signed successfully',
        'Signed record and onboarding case have been generated automatically.',
        'lead',
        p_lead_id::text
      );
    end if;

    return v_signed_id;
  end if;

  return null;
end;
$$;

create or replace function public.change_onboarding_status(
  p_onboarding_case_id uuid,
  p_to_status public.onboarding_status,
  p_reason text default null,
  p_pm_owner_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.onboarding_cases;
  v_project_id uuid;
  v_is_valid boolean;
begin
  select * into v_case
  from public.onboarding_cases
  where id = p_onboarding_case_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Onboarding case not found: %', p_onboarding_case_id;
  end if;

  if not public.can_access_onboarding_case(p_onboarding_case_id, auth.uid()) then
    raise exception 'Permission denied for onboarding case: %', p_onboarding_case_id;
  end if;

  if v_case.status = p_to_status then
    return null;
  end if;

  v_is_valid := (
    (v_case.status = 'NOT_STARTED' and p_to_status in ('INFO_PENDING', 'REJECTED')) or
    (v_case.status = 'INFO_PENDING' and p_to_status in ('DOCUMENT_PENDING', 'REJECTED')) or
    (v_case.status = 'DOCUMENT_PENDING' and p_to_status in ('UNDER_REVIEW', 'REJECTED')) or
    (v_case.status = 'UNDER_REVIEW' and p_to_status in ('REVISION_REQUIRED', 'CONTRACT_CONFIRMED', 'REJECTED')) or
    (v_case.status = 'REVISION_REQUIRED' and p_to_status in ('DOCUMENT_PENDING', 'REJECTED')) or
    (v_case.status = 'CONTRACT_CONFIRMED' and p_to_status in ('SERVICE_ACTIVATING', 'REJECTED')) or
    (v_case.status = 'SERVICE_ACTIVATING' and p_to_status in ('COMPLETED', 'REJECTED'))
  );

  if not v_is_valid then
    raise exception 'Invalid onboarding status transition from % to %', v_case.status, p_to_status;
  end if;

  update public.onboarding_cases
  set
    status = p_to_status,
    updated_by = auth.uid(),
    updated_at = timezone('utc', now()),
    completed_at = case when p_to_status = 'COMPLETED' then timezone('utc', now()) else completed_at end,
    rejected_at = case when p_to_status = 'REJECTED' then timezone('utc', now()) else rejected_at end,
    remarks = coalesce(p_reason, remarks)
  where id = p_onboarding_case_id;

  insert into public.onboarding_status_logs (onboarding_case_id, from_status, to_status, reason, changed_by)
  values (p_onboarding_case_id, v_case.status, p_to_status, p_reason, auth.uid());

  perform public.record_operation_log(
    'onboarding',
    'onboarding_cases',
    p_onboarding_case_id::text,
    'change_status',
    jsonb_build_object('status', v_case.status),
    jsonb_build_object('status', p_to_status, 'reason', p_reason),
    null
  );

  if p_to_status = 'UNDER_REVIEW' and v_case.reviewer_user_id is not null then
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      v_case.reviewer_user_id,
      'onboarding_under_review',
      'Onboarding case waiting for review',
      'An onboarding case has entered UNDER_REVIEW and needs your decision.',
      'onboarding_case',
      p_onboarding_case_id::text
    );
  end if;

  if p_to_status = 'REVISION_REQUIRED' and v_case.owner_user_id is not null then
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      v_case.owner_user_id,
      'onboarding_revision_required',
      'Onboarding revision required',
      'Please resubmit required documents based on review comments.',
      'onboarding_case',
      p_onboarding_case_id::text
    );
  end if;

  if p_to_status = 'COMPLETED' then
    v_project_id := public.create_project_from_onboarding(p_onboarding_case_id, p_pm_owner_id);
    return v_project_id;
  end if;

  return null;
end;
$$;

create or replace function public.change_project_status(
  p_project_id uuid,
  p_to_status public.project_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_is_valid boolean;
begin
  select * into v_project
  from public.projects
  where id = p_project_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Project not found: %', p_project_id;
  end if;

  if not public.can_access_project(p_project_id, auth.uid()) then
    raise exception 'Permission denied for project: %', p_project_id;
  end if;

  if v_project.status = p_to_status then
    return;
  end if;

  v_is_valid := (
    (v_project.status = 'NOT_STARTED' and p_to_status in ('IN_PROGRESS', 'ON_HOLD', 'DELAYED')) or
    (v_project.status = 'IN_PROGRESS' and p_to_status in ('ON_HOLD', 'DELAYED', 'COMPLETED')) or
    (v_project.status = 'ON_HOLD' and p_to_status in ('IN_PROGRESS', 'DELAYED', 'CLOSED')) or
    (v_project.status = 'DELAYED' and p_to_status in ('IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED')) or
    (v_project.status = 'COMPLETED' and p_to_status in ('CLOSED'))
  );

  if not v_is_valid then
    raise exception 'Invalid project status transition from % to %', v_project.status, p_to_status;
  end if;

  if p_to_status = 'DELAYED' and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'DELAYED status requires a reason';
  end if;

  update public.projects
  set
    status = p_to_status,
    delay_reason = case when p_to_status = 'DELAYED' then p_reason else delay_reason end,
    actual_end_date = case when p_to_status = 'COMPLETED' then current_date else actual_end_date end,
    closed_at = case when p_to_status = 'CLOSED' then timezone('utc', now()) else closed_at end,
    updated_by = auth.uid(),
    updated_at = timezone('utc', now())
  where id = p_project_id;

  insert into public.project_status_logs (project_id, from_status, to_status, reason, changed_by)
  values (p_project_id, v_project.status, p_to_status, p_reason, auth.uid());

  perform public.record_operation_log(
    'projects',
    'projects',
    p_project_id::text,
    'change_status',
    jsonb_build_object('status', v_project.status),
    jsonb_build_object('status', p_to_status, 'reason', p_reason),
    null
  );
end;
$$;

create or replace function public.refresh_project_progress(p_project_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_progress numeric;
  v_milestone_progress numeric;
  v_result numeric;
  v_is_delayed boolean;
begin
  select avg(progress)
    into v_task_progress
  from public.project_tasks
  where project_id = p_project_id
    and deleted_at is null;

  if v_task_progress is null then
    select avg(progress)
      into v_milestone_progress
    from public.project_milestones
    where project_id = p_project_id;
  end if;

  v_result := coalesce(v_task_progress, v_milestone_progress, 0);

  select (
    (
      exists (
        select 1
        from public.projects p
        where p.id = p_project_id
          and p.target_end_date is not null
          and p.target_end_date < current_date
          and p.status not in ('COMPLETED', 'CLOSED')
      )
    )
    or exists (
      select 1
      from public.project_tasks t
      where t.project_id = p_project_id
        and t.deleted_at is null
        and t.status not in ('DONE', 'CANCELLED')
        and t.due_date is not null
        and t.due_date < current_date
    )
  ) into v_is_delayed;

  update public.projects
  set
    completion_rate = v_result,
    is_delayed = v_is_delayed,
    status = case
      when status in ('COMPLETED', 'CLOSED') then status
      when v_is_delayed then 'DELAYED'
      else status
    end,
    updated_at = timezone('utc', now()),
    updated_by = auth.uid()
  where id = p_project_id;

  return v_result;
end;
$$;

create or replace function public.mark_delayed_projects()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_project record;
begin
  for v_project in
    select id
    from public.projects
    where deleted_at is null
      and status not in ('COMPLETED', 'CLOSED')
  loop
    perform public.refresh_project_progress(v_project.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- =====================================
-- Permission seed expansion
-- =====================================
insert into public.permissions (code, module, action, description)
values
  ('leads.assign', 'leads', 'assign', 'Assign lead ownership'),
  ('leads.import', 'leads', 'import', 'Bulk import leads'),
  ('leads.status.change', 'leads', 'status_change', 'Change lead status via state machine'),
  ('contracts.write', 'contracts', 'write', 'Create and maintain signed records'),
  ('onboarding.review', 'onboarding', 'review', 'Review onboarding documents and cases'),
  ('projects.member.manage', 'projects', 'member_manage', 'Manage project members'),
  ('projects.task.manage', 'projects', 'task_manage', 'Manage project tasks'),
  ('reports.export', 'reports', 'export', 'Export business reports'),
  ('system.config', 'system', 'config', 'Manage system configurations')
on conflict (code) do update
  set module = excluded.module,
      action = excluded.action,
      description = excluded.description;

insert into public.role_permission_relations (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'leads.assign',
  'leads.import',
  'leads.status.change',
  'contracts.write',
  'onboarding.review',
  'projects.member.manage',
  'projects.task.manage',
  'reports.export',
  'system.config'
)
where r.code = 'super_admin'
on conflict do nothing;

insert into public.role_permission_relations (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'leads.status.change',
  'contracts.write'
)
where r.code = 'bd_user'
on conflict do nothing;

insert into public.role_permission_relations (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'onboarding.review',
  'projects.member.manage',
  'projects.task.manage'
)
where r.code = 'project_manager'
on conflict do nothing;

-- Additional dictionary values
insert into public.dictionary_items (dictionary_type, code, label, sort_order, is_active)
values
  ('lead_lost_reason', 'PRICE', 'Pricing mismatch', 10, true),
  ('lead_lost_reason', 'LOCATION', 'Location not suitable', 20, true),
  ('lead_lost_reason', 'COMPETITOR', 'Chose competitor', 30, true),
  ('lead_lost_reason', 'BUDGET', 'Budget constraints', 40, true),
  ('lead_lost_reason', 'OTHER', 'Other', 90, true),
  ('followup_type', 'CALL', 'Call', 10, true),
  ('followup_type', 'VISIT', 'Visit', 20, true),
  ('followup_type', 'MEETING', 'Meeting', 30, true),
  ('followup_type', 'CHAT', 'Chat', 40, true),
  ('followup_type', 'EMAIL', 'Email', 50, true)
on conflict (dictionary_type, code) do update
  set label = excluded.label,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active;

-- =====================================
-- Grants
-- =====================================
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.lead_followups to authenticated;
grant select, insert, update, delete on public.lead_attachments to authenticated;
grant select, insert, update, delete on public.lead_assignment_logs to authenticated;
grant select, insert on public.lead_status_logs to authenticated;
grant select, insert, update on public.signed_records to authenticated;
grant select, insert, update, delete on public.onboarding_cases to authenticated;
grant select, insert, update, delete on public.onboarding_steps to authenticated;
grant select, insert, update, delete on public.onboarding_documents to authenticated;
grant select, insert on public.onboarding_reviews to authenticated;
grant select, insert on public.onboarding_status_logs to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_members to authenticated;
grant select, insert, update, delete on public.project_milestones to authenticated;
grant select, insert, update, delete on public.project_tasks to authenticated;
grant select, insert on public.project_status_logs to authenticated;
grant select, insert on public.project_updates to authenticated;
grant select, insert, update on public.report_exports to authenticated;
grant usage, select on all sequences in schema public to authenticated, service_role;

grant execute on function public.can_access_lead(uuid, uuid) to authenticated;
grant execute on function public.can_access_onboarding_case(uuid, uuid) to authenticated;
grant execute on function public.can_access_project(uuid, uuid) to authenticated;
grant execute on function public.create_onboarding_case_from_signed(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.create_project_from_onboarding(uuid, uuid) to authenticated;
grant execute on function public.change_lead_status(uuid, public.lead_status, text, text, text, date, numeric) to authenticated;
grant execute on function public.change_onboarding_status(uuid, public.onboarding_status, text, uuid) to authenticated;
grant execute on function public.change_project_status(uuid, public.project_status, text) to authenticated;
grant execute on function public.refresh_project_progress(uuid) to authenticated;
grant execute on function public.mark_delayed_projects() to authenticated;

-- =====================================
-- RLS enable
-- =====================================
alter table public.leads enable row level security;
alter table public.lead_followups enable row level security;
alter table public.lead_attachments enable row level security;
alter table public.lead_assignment_logs enable row level security;
alter table public.lead_status_logs enable row level security;
alter table public.signed_records enable row level security;
alter table public.onboarding_cases enable row level security;
alter table public.onboarding_steps enable row level security;
alter table public.onboarding_documents enable row level security;
alter table public.onboarding_reviews enable row level security;
alter table public.onboarding_status_logs enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_status_logs enable row level security;
alter table public.project_updates enable row level security;
alter table public.report_exports enable row level security;

-- =====================================
-- RLS policies
-- =====================================
DROP POLICY IF EXISTS leads_select_policy ON public.leads;
create policy leads_select_policy
on public.leads
for select to authenticated
using (public.can_access_lead(id, auth.uid()));

DROP POLICY IF EXISTS leads_insert_policy ON public.leads;
create policy leads_insert_policy
on public.leads
for insert to authenticated
with check (
  public.has_permission('leads.write', auth.uid())
  and (
    created_by = auth.uid()
    or public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS leads_update_policy ON public.leads;
create policy leads_update_policy
on public.leads
for update to authenticated
using (
  public.can_access_lead(id, auth.uid())
  and public.has_permission('leads.write', auth.uid())
)
with check (
  public.can_access_lead(id, auth.uid())
  and public.has_permission('leads.write', auth.uid())
);

DROP POLICY IF EXISTS leads_delete_policy ON public.leads;
create policy leads_delete_policy
on public.leads
for delete to authenticated
using (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS lead_followups_select_policy ON public.lead_followups;
create policy lead_followups_select_policy
on public.lead_followups
for select to authenticated
using (public.can_access_lead(lead_id, auth.uid()));

DROP POLICY IF EXISTS lead_followups_insert_policy ON public.lead_followups;
create policy lead_followups_insert_policy
on public.lead_followups
for insert to authenticated
with check (
  public.can_access_lead(lead_id, auth.uid())
  and public.has_permission('leads.write', auth.uid())
);

DROP POLICY IF EXISTS lead_followups_update_policy ON public.lead_followups;
create policy lead_followups_update_policy
on public.lead_followups
for update to authenticated
using (
  public.can_access_lead(lead_id, auth.uid())
  and public.has_permission('leads.write', auth.uid())
)
with check (
  public.can_access_lead(lead_id, auth.uid())
  and public.has_permission('leads.write', auth.uid())
);

DROP POLICY IF EXISTS lead_attachments_select_policy ON public.lead_attachments;
create policy lead_attachments_select_policy
on public.lead_attachments
for select to authenticated
using (public.can_access_lead(lead_id, auth.uid()));

DROP POLICY IF EXISTS lead_attachments_insert_policy ON public.lead_attachments;
create policy lead_attachments_insert_policy
on public.lead_attachments
for insert to authenticated
with check (
  public.can_access_lead(lead_id, auth.uid())
  and public.has_permission('leads.write', auth.uid())
);

DROP POLICY IF EXISTS lead_attachments_delete_policy ON public.lead_attachments;
create policy lead_attachments_delete_policy
on public.lead_attachments
for delete to authenticated
using (
  public.can_access_lead(lead_id, auth.uid())
  and public.has_permission('leads.write', auth.uid())
);

DROP POLICY IF EXISTS lead_assignment_logs_select_policy ON public.lead_assignment_logs;
create policy lead_assignment_logs_select_policy
on public.lead_assignment_logs
for select to authenticated
using (public.can_access_lead(lead_id, auth.uid()));

DROP POLICY IF EXISTS lead_assignment_logs_insert_policy ON public.lead_assignment_logs;
create policy lead_assignment_logs_insert_policy
on public.lead_assignment_logs
for insert to authenticated
with check (
  public.can_access_lead(lead_id, auth.uid())
  and (public.has_permission('leads.assign', auth.uid()) or public.is_super_admin(auth.uid()))
);

DROP POLICY IF EXISTS lead_status_logs_select_policy ON public.lead_status_logs;
create policy lead_status_logs_select_policy
on public.lead_status_logs
for select to authenticated
using (public.can_access_lead(lead_id, auth.uid()));

DROP POLICY IF EXISTS lead_status_logs_insert_policy ON public.lead_status_logs;
create policy lead_status_logs_insert_policy
on public.lead_status_logs
for insert to authenticated
with check (public.can_access_lead(lead_id, auth.uid()));

DROP POLICY IF EXISTS signed_records_select_policy ON public.signed_records;
create policy signed_records_select_policy
on public.signed_records
for select to authenticated
using (public.can_access_lead(lead_id, auth.uid()));

DROP POLICY IF EXISTS signed_records_insert_policy ON public.signed_records;
create policy signed_records_insert_policy
on public.signed_records
for insert to authenticated
with check (
  public.can_access_lead(lead_id, auth.uid())
  and (public.has_permission('contracts.write', auth.uid()) or public.has_permission('leads.write', auth.uid()))
);

DROP POLICY IF EXISTS signed_records_update_policy ON public.signed_records;
create policy signed_records_update_policy
on public.signed_records
for update to authenticated
using (
  public.can_access_lead(lead_id, auth.uid())
  and (public.has_permission('contracts.write', auth.uid()) or public.has_permission('leads.write', auth.uid()))
)
with check (
  public.can_access_lead(lead_id, auth.uid())
  and (public.has_permission('contracts.write', auth.uid()) or public.has_permission('leads.write', auth.uid()))
);

DROP POLICY IF EXISTS onboarding_cases_select_policy ON public.onboarding_cases;
create policy onboarding_cases_select_policy
on public.onboarding_cases
for select to authenticated
using (public.can_access_onboarding_case(id, auth.uid()));

DROP POLICY IF EXISTS onboarding_cases_insert_policy ON public.onboarding_cases;
create policy onboarding_cases_insert_policy
on public.onboarding_cases
for insert to authenticated
with check (
  public.can_access_onboarding_case(id, auth.uid())
  or public.is_super_admin(auth.uid())
  or public.has_permission('onboarding.write', auth.uid())
);

DROP POLICY IF EXISTS onboarding_cases_update_policy ON public.onboarding_cases;
create policy onboarding_cases_update_policy
on public.onboarding_cases
for update to authenticated
using (
  public.can_access_onboarding_case(id, auth.uid())
  and public.has_permission('onboarding.write', auth.uid())
)
with check (
  public.can_access_onboarding_case(id, auth.uid())
  and public.has_permission('onboarding.write', auth.uid())
);

DROP POLICY IF EXISTS onboarding_steps_select_policy ON public.onboarding_steps;
create policy onboarding_steps_select_policy
on public.onboarding_steps
for select to authenticated
using (public.can_access_onboarding_case(onboarding_case_id, auth.uid()));

DROP POLICY IF EXISTS onboarding_steps_manage_policy ON public.onboarding_steps;
create policy onboarding_steps_manage_policy
on public.onboarding_steps
for all to authenticated
using (
  public.can_access_onboarding_case(onboarding_case_id, auth.uid())
  and public.has_permission('onboarding.write', auth.uid())
)
with check (
  public.can_access_onboarding_case(onboarding_case_id, auth.uid())
  and public.has_permission('onboarding.write', auth.uid())
);

DROP POLICY IF EXISTS onboarding_documents_select_policy ON public.onboarding_documents;
create policy onboarding_documents_select_policy
on public.onboarding_documents
for select to authenticated
using (public.can_access_onboarding_case(onboarding_case_id, auth.uid()));

DROP POLICY IF EXISTS onboarding_documents_manage_policy ON public.onboarding_documents;
create policy onboarding_documents_manage_policy
on public.onboarding_documents
for all to authenticated
using (
  public.can_access_onboarding_case(onboarding_case_id, auth.uid())
  and public.has_permission('onboarding.write', auth.uid())
)
with check (
  public.can_access_onboarding_case(onboarding_case_id, auth.uid())
  and public.has_permission('onboarding.write', auth.uid())
);

DROP POLICY IF EXISTS onboarding_reviews_select_policy ON public.onboarding_reviews;
create policy onboarding_reviews_select_policy
on public.onboarding_reviews
for select to authenticated
using (public.can_access_onboarding_case(onboarding_case_id, auth.uid()));

DROP POLICY IF EXISTS onboarding_reviews_insert_policy ON public.onboarding_reviews;
create policy onboarding_reviews_insert_policy
on public.onboarding_reviews
for insert to authenticated
with check (
  public.can_access_onboarding_case(onboarding_case_id, auth.uid())
  and (public.has_permission('onboarding.review', auth.uid()) or public.has_permission('onboarding.write', auth.uid()))
);

DROP POLICY IF EXISTS onboarding_status_logs_select_policy ON public.onboarding_status_logs;
create policy onboarding_status_logs_select_policy
on public.onboarding_status_logs
for select to authenticated
using (public.can_access_onboarding_case(onboarding_case_id, auth.uid()));

DROP POLICY IF EXISTS onboarding_status_logs_insert_policy ON public.onboarding_status_logs;
create policy onboarding_status_logs_insert_policy
on public.onboarding_status_logs
for insert to authenticated
with check (public.can_access_onboarding_case(onboarding_case_id, auth.uid()));

DROP POLICY IF EXISTS projects_select_policy ON public.projects;
create policy projects_select_policy
on public.projects
for select to authenticated
using (public.can_access_project(id, auth.uid()));

DROP POLICY IF EXISTS projects_insert_policy ON public.projects;
create policy projects_insert_policy
on public.projects
for insert to authenticated
with check (
  (public.has_permission('projects.write', auth.uid()) or public.is_super_admin(auth.uid()))
  and (pm_owner_id = auth.uid() or bd_owner_id = auth.uid() or public.is_super_admin(auth.uid()))
);

DROP POLICY IF EXISTS projects_update_policy ON public.projects;
create policy projects_update_policy
on public.projects
for update to authenticated
using (
  public.can_access_project(id, auth.uid())
  and public.has_permission('projects.write', auth.uid())
)
with check (
  public.can_access_project(id, auth.uid())
  and public.has_permission('projects.write', auth.uid())
);

DROP POLICY IF EXISTS project_members_select_policy ON public.project_members;
create policy project_members_select_policy
on public.project_members
for select to authenticated
using (public.can_access_project(project_id, auth.uid()));

DROP POLICY IF EXISTS project_members_manage_policy ON public.project_members;
create policy project_members_manage_policy
on public.project_members
for all to authenticated
using (
  public.can_access_project(project_id, auth.uid())
  and (public.has_permission('projects.member.manage', auth.uid()) or public.has_permission('projects.write', auth.uid()))
)
with check (
  public.can_access_project(project_id, auth.uid())
  and (public.has_permission('projects.member.manage', auth.uid()) or public.has_permission('projects.write', auth.uid()))
);

DROP POLICY IF EXISTS project_milestones_select_policy ON public.project_milestones;
create policy project_milestones_select_policy
on public.project_milestones
for select to authenticated
using (public.can_access_project(project_id, auth.uid()));

DROP POLICY IF EXISTS project_milestones_manage_policy ON public.project_milestones;
create policy project_milestones_manage_policy
on public.project_milestones
for all to authenticated
using (
  public.can_access_project(project_id, auth.uid())
  and public.has_permission('projects.write', auth.uid())
)
with check (
  public.can_access_project(project_id, auth.uid())
  and public.has_permission('projects.write', auth.uid())
);

DROP POLICY IF EXISTS project_tasks_select_policy ON public.project_tasks;
create policy project_tasks_select_policy
on public.project_tasks
for select to authenticated
using (public.can_access_project(project_id, auth.uid()));

DROP POLICY IF EXISTS project_tasks_manage_policy ON public.project_tasks;
create policy project_tasks_manage_policy
on public.project_tasks
for all to authenticated
using (
  public.can_access_project(project_id, auth.uid())
  and (public.has_permission('projects.task.manage', auth.uid()) or public.has_permission('projects.write', auth.uid()))
)
with check (
  public.can_access_project(project_id, auth.uid())
  and (public.has_permission('projects.task.manage', auth.uid()) or public.has_permission('projects.write', auth.uid()))
);

DROP POLICY IF EXISTS project_status_logs_select_policy ON public.project_status_logs;
create policy project_status_logs_select_policy
on public.project_status_logs
for select to authenticated
using (public.can_access_project(project_id, auth.uid()));

DROP POLICY IF EXISTS project_status_logs_insert_policy ON public.project_status_logs;
create policy project_status_logs_insert_policy
on public.project_status_logs
for insert to authenticated
with check (public.can_access_project(project_id, auth.uid()));

DROP POLICY IF EXISTS project_updates_select_policy ON public.project_updates;
create policy project_updates_select_policy
on public.project_updates
for select to authenticated
using (public.can_access_project(project_id, auth.uid()));

DROP POLICY IF EXISTS project_updates_insert_policy ON public.project_updates;
create policy project_updates_insert_policy
on public.project_updates
for insert to authenticated
with check (public.can_access_project(project_id, auth.uid()));

DROP POLICY IF EXISTS report_exports_select_policy ON public.report_exports;
create policy report_exports_select_policy
on public.report_exports
for select to authenticated
using (requested_by = auth.uid() or public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS report_exports_insert_policy ON public.report_exports;
create policy report_exports_insert_policy
on public.report_exports
for insert to authenticated
with check (
  requested_by = auth.uid()
  and public.has_permission('reports.export', auth.uid())
);

DROP POLICY IF EXISTS report_exports_update_policy ON public.report_exports;
create policy report_exports_update_policy
on public.report_exports
for update to authenticated
using (
  requested_by = auth.uid() or public.is_super_admin(auth.uid())
)
with check (
  requested_by = auth.uid() or public.is_super_admin(auth.uid())
);

commit;
