begin;

-- 1) Extend lead status for rejected lead qualification.
alter type public.lead_status add value if not exists 'REJECTED';

-- 2) Lead enrichment fields (package intent + collaboration notes + duplicate distinction).
alter table public.leads
  add column if not exists intent_package text,
  add column if not exists bd_notes text,
  add column if not exists team_attention_note text,
  add column if not exists duplicate_note text;

-- 3) Follow-up now can carry note updates.
alter table public.lead_followups
  add column if not exists bd_notes text,
  add column if not exists team_attention_note text;

-- 4) Signed record stores package selection instead of numeric contract value for BD workflow.
alter table public.signed_records
  add column if not exists contract_package text;

-- 5) Optional lightweight constraints for package values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_intent_package_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_intent_package_check
      check (intent_package is null or intent_package in ('BCS', 'PRODUCTS_SALES'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'signed_records_contract_package_check'
      and conrelid = 'public.signed_records'::regclass
  ) then
    alter table public.signed_records
      add constraint signed_records_contract_package_check
      check (contract_package is null or contract_package in ('BCS', 'PRODUCTS_SALES'));
  end if;
end
$$;

-- 6) Duplicate check acceleration (case-insensitive company name match).
create index if not exists idx_leads_company_name_lower
  on public.leads (lower(company_name))
  where deleted_at is null;

commit;
