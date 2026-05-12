begin;

alter table public.leads
  drop constraint if exists leads_intent_package_check;

alter table public.leads
  add constraint leads_intent_package_check
  check (intent_package is null or intent_package in ('BCS', 'PRODUCTS_SALES', 'BOTH'));

alter table public.signed_records
  drop constraint if exists signed_records_contract_package_check;

alter table public.signed_records
  add constraint signed_records_contract_package_check
  check (contract_package is null or contract_package in ('BCS', 'PRODUCTS_SALES', 'BOTH'));

create or replace function public.fill_lead_code_from_created_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_suffix text;
begin
  if new.created_at is null then
    new.created_at := timezone('utc', now());
  end if;

  v_prefix := case
    when new.intent_package = 'PRODUCTS_SALES' then 'SP'
    else 'LD'
  end;

  if new.lead_code is null or trim(new.lead_code) = '' then
    new.lead_code :=
      v_prefix
      || '-'
      || to_char(new.created_at at time zone 'utc', 'YYYYMMDD')
      || '-'
      || upper(substr(gen_random_uuid()::text, 1, 6));

    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(new.intent_package, '') is distinct from coalesce(old.intent_package, '') then
    v_suffix := substring(new.lead_code from '^[A-Za-z]{2}-(.+)$');

    if v_suffix is null then
      new.lead_code :=
        v_prefix
        || '-'
        || to_char(new.created_at at time zone 'utc', 'YYYYMMDD')
        || '-'
        || upper(substr(gen_random_uuid()::text, 1, 6));
    else
      new.lead_code := v_prefix || '-' || v_suffix;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leads_fill_code_from_created_at on public.leads;
create trigger trg_leads_fill_code_from_created_at
before insert or update of intent_package on public.leads
for each row
execute function public.fill_lead_code_from_created_at();

commit;
