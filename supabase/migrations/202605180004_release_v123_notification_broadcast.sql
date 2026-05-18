-- Broadcast V1.2.3 release update to all existing users.
-- English-only message, idempotent by user + announcement identity.

with release_content as (
  select
    p.id as user_id,
    'System Update Log V1.2.3'::text as title,
    $body$
Version: V1.2.0 -> V1.2.3

I. Admin Portal
1) Added Sales Lead Export in Report Export Center.
2) Added export filters:
   - Time range
   - Specific user selection

II. BD Portal
Fixes
1) Fixed incomplete lead list visibility in My Leads for BD accounts.
2) Fixed submission failure for newly added sales categories (for example: Battery).

Adjustments
1) Removed "Estimated Amount" field from BD lead creation.
2) Added "Department Leads" (read-only):
   - Includes BD-created leads, admin-created assigned leads, and department-wide lead overview.
   - Supports search, query, and detail view.
   - No edit/manage permission for BD users in this module.
3) Renamed "Lead Pool" to "My Leads":
   - Scope: self-created leads + leads assigned by admin.
   - BD can edit/manage only leads under their own ownership scope.

III. PMO Portal
1) Added "Create Sales Lead" in Sales Management.
2) PMO can assign BD owner when creating a sales lead.
3) Created/assigned sales leads are synchronized to:
   - Target BD sales records
   - Target BD KPI records

IV. KPI Optimization (Admin)
1) Added exemption rule:
   - If a BD's monthly sales amount exceeds IDR 5,000,000,
     the monthly BCS contract-count target can be exempted.
2) Split KPI sales into:
   - Tire Sales
   - Accessory Sales
   Rule: non-tire sales are counted as Accessory Sales.
3) Corrected KPI calculation source:
   - KPI sales amount/volume now comes from actual sales records,
     not estimated amount in lead data.

V. Summary
This release improves sales lead export, BD permission scope, PMO lead creation and assignment flow, and KPI calculation accuracy.
$body$::text as body
  from public.profiles p
)
insert into public.notifications (
  user_id,
  type,
  title,
  body,
  entity_type,
  entity_id,
  is_read
)
select
  rc.user_id,
  'system_announcement',
  rc.title,
  rc.body,
  'system_release_note',
  'release-v1.2.3-2026-05-18',
  false
from release_content rc
where not exists (
  select 1
  from public.notifications n
  where n.user_id = rc.user_id
    and n.type = 'system_announcement'
    and n.entity_type = 'system_release_note'
    and n.entity_id = 'release-v1.2.3-2026-05-18'
);
