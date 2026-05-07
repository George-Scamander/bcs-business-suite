-- Lead creation hardening:
-- 1) support intent_level H0-H5 (0..5)
-- 2) generate lead_code date segment from created_at
-- 3) expose duplicate-company check RPC for UI validation

create or replace function public.normalize_company_name(p_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(p_name, ''))), '[[:space:][:punct:]_]+', '', 'g')
$$;

create or replace function public.find_duplicate_lead_companies(
  p_company_name text,
  p_exclude_lead_id uuid default null
)
returns table (
  id uuid,
  lead_code text,
  company_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.lead_code, l.company_name
  from public.leads l
  where l.deleted_at is null
    and public.normalize_company_name(l.company_name) = public.normalize_company_name(p_company_name)
    and (p_exclude_lead_id is null or l.id <> p_exclude_lead_id)
  order by l.created_at desc
$$;

grant execute on function public.find_duplicate_lead_companies(text, uuid) to authenticated;

create or replace function public.fill_lead_code_from_created_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_at is null then
    new.created_at := timezone('utc', now());
  end if;

  if new.lead_code is null or trim(new.lead_code) = '' then
    new.lead_code := 'LD-' || to_char(new.created_at at time zone 'utc', 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));
  end if;

  return new;
end;
$$;

alter table public.leads alter column lead_code drop default;

drop trigger if exists trg_leads_fill_code_from_created_at on public.leads;
create trigger trg_leads_fill_code_from_created_at
before insert on public.leads
for each row
execute function public.fill_lead_code_from_created_at();

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.leads'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%intent_level%'
  loop
    execute format('alter table public.leads drop constraint if exists %I', v_constraint.conname);
  end loop;
end;
$$;

alter table public.leads
add constraint leads_intent_level_check
check (intent_level is null or intent_level between 0 and 5);
