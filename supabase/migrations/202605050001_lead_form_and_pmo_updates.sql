-- Lead/PMO patch: options dictionary, PMO permissions, and team attention note guard.

alter table public.leads
  add column if not exists team_attention_note text;

alter table public.projects
  alter column onboarding_case_id drop not null;

create or replace function public.prevent_non_admin_team_attention_note_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.team_attention_note is distinct from old.team_attention_note
    and not public.is_super_admin(auth.uid()) then
    raise exception 'Only super admin can edit team attention note';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leads_guard_team_attention_note on public.leads;
create trigger trg_leads_guard_team_attention_note
before update on public.leads
for each row
execute function public.prevent_non_admin_team_attention_note_update();

insert into public.permissions (code, module, action, description)
values
  ('leads.import', 'leads', 'import', 'Bulk import leads')
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

-- Grant PM role ability to create/import leads.
insert into public.role_permission_relations (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('leads.write', 'leads.import')
where r.code = 'project_manager'
on conflict do nothing;

-- Remove file upload permission from BD role.
delete from public.role_permission_relations rel
using public.roles r, public.permissions p
where rel.role_id = r.id
  and rel.permission_id = p.id
  and r.code = 'bd_user'
  and p.code = 'files.upload';

-- Region/city dictionary for cascading dropdown.
insert into public.dictionary_items (dictionary_type, code, label, sort_order, is_active)
values
  ('lead_region', 'DKI_JAKARTA', 'DKI Jakarta', 10, true),
  ('lead_region', 'WEST_JAVA', 'West Java', 20, true),
  ('lead_region', 'CENTRAL_JAVA', 'Central Java', 30, true),
  ('lead_region', 'EAST_JAVA', 'East Java', 40, true),
  ('lead_region', 'BANTEN', 'Banten', 50, true),
  ('lead_region', 'DI_YOGYAKARTA', 'DI Yogyakarta', 60, true),
  ('lead_region', 'BALI', 'Bali', 70, true),
  ('lead_region', 'NORTH_SUMATRA', 'North Sumatra', 80, true),
  ('lead_region', 'SOUTH_SUMATRA', 'South Sumatra', 90, true),
  ('lead_region', 'RIAU', 'Riau', 100, true),
  ('lead_region', 'SOUTH_SULAWESI', 'South Sulawesi', 110, true),
  ('lead_region', 'NORTH_SULAWESI', 'North Sulawesi', 120, true),
  ('lead_region', 'EAST_KALIMANTAN', 'East Kalimantan', 130, true),
  ('lead_region', 'WEST_KALIMANTAN', 'West Kalimantan', 140, true),
  ('lead_region', 'PAPUA', 'Papua', 150, true)
on conflict (dictionary_type, code) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());

insert into public.dictionary_items (dictionary_type, code, label, sort_order, is_active)
values
  ('lead_region_city', 'DKI_JAKARTA::CENTRAL_JAKARTA', 'Central Jakarta', 10, true),
  ('lead_region_city', 'DKI_JAKARTA::NORTH_JAKARTA', 'North Jakarta', 20, true),
  ('lead_region_city', 'DKI_JAKARTA::SOUTH_JAKARTA', 'South Jakarta', 30, true),
  ('lead_region_city', 'DKI_JAKARTA::WEST_JAKARTA', 'West Jakarta', 40, true),
  ('lead_region_city', 'DKI_JAKARTA::EAST_JAKARTA', 'East Jakarta', 50, true),
  ('lead_region_city', 'WEST_JAVA::BANDUNG', 'Bandung', 60, true),
  ('lead_region_city', 'WEST_JAVA::BOGOR', 'Bogor', 70, true),
  ('lead_region_city', 'WEST_JAVA::BEKASI', 'Bekasi', 80, true),
  ('lead_region_city', 'WEST_JAVA::DEPOK', 'Depok', 90, true),
  ('lead_region_city', 'CENTRAL_JAVA::SEMARANG', 'Semarang', 100, true),
  ('lead_region_city', 'CENTRAL_JAVA::SURAKARTA', 'Surakarta', 110, true),
  ('lead_region_city', 'EAST_JAVA::SURABAYA', 'Surabaya', 120, true),
  ('lead_region_city', 'EAST_JAVA::MALANG', 'Malang', 130, true),
  ('lead_region_city', 'BANTEN::TANGERANG', 'Tangerang', 140, true),
  ('lead_region_city', 'DI_YOGYAKARTA::YOGYAKARTA', 'Yogyakarta', 150, true),
  ('lead_region_city', 'BALI::DENPASAR', 'Denpasar', 160, true),
  ('lead_region_city', 'NORTH_SUMATRA::MEDAN', 'Medan', 170, true),
  ('lead_region_city', 'SOUTH_SUMATRA::PALEMBANG', 'Palembang', 180, true),
  ('lead_region_city', 'RIAU::PEKANBARU', 'Pekanbaru', 190, true),
  ('lead_region_city', 'SOUTH_SULAWESI::MAKASSAR', 'Makassar', 200, true),
  ('lead_region_city', 'NORTH_SULAWESI::MANADO', 'Manado', 210, true),
  ('lead_region_city', 'EAST_KALIMANTAN::SAMARINDA', 'Samarinda', 220, true),
  ('lead_region_city', 'WEST_KALIMANTAN::PONTIANAK', 'Pontianak', 230, true),
  ('lead_region_city', 'PAPUA::JAYAPURA', 'Jayapura', 240, true)
on conflict (dictionary_type, code) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());

insert into public.dictionary_items (dictionary_type, code, label, sort_order, is_active)
values
  ('lead_source', 'COLD_VISIT', 'Cold Visit', 10, true),
  ('lead_source', 'REFERRAL', 'Referral', 20, true),
  ('lead_source', 'EVENT', 'Event', 30, true),
  ('lead_source', 'SOCIAL_MEDIA', 'Social Media', 40, true),
  ('lead_source', 'WEBSITE_INQUIRY', 'Website Inquiry', 50, true),
  ('lead_source', 'PARTNER_CHANNEL', 'Partner Channel', 60, true)
on conflict (dictionary_type, code) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());
