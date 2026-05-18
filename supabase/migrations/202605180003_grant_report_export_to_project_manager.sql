begin;

insert into public.role_permission_relations (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'reports.export'
where r.code = 'project_manager'
on conflict do nothing;

commit;
