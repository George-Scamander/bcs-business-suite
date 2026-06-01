-- Broadcast V1.3.1 system update log to all existing users.
-- English-only message, idempotent by user + announcement identity.

with release_content as (
  select
    p.id as user_id,
    'BCS Business System Update Log V1.3.1'::text as title,
    $body$
Version: V1.3.1
Date: June 1, 2026

1) Lead Region Distribution Upgrade
- Region Distribution is now integrated into the Lead Pool management action area.
- Clicking it opens a dedicated standalone page (no duplicated app shell/sidebar).
- The page UI and language support were improved, including mobile responsiveness.
- Data source is unified to active leads in the lead pool, with updates reflected as new leads are added.

2) Lead Pool & Follow-up Improvements
- PM lead pool is now unified with the Admin lead pool.
- Added Latest Follow-up Time in lead list views.
- Preserved Expected Next Follow-up Time.
- For BD users creating a lead for the first time: if Next Follow-up Time is not entered manually, it defaults to 7 days later.
- Follow-up and status update flows are now more tightly linked during BD operations.

3) Admin Dashboard Sales Module Optimization
- Sales Category Overview now supports month filtering.
- Top summary cards now reflect selected-month totals (sales amount, sales quantity, etc.).
- Detailed category breakdown remains in the table below (quantity, amount, share).

4) Category Logic Refactor (Data-Safe)
- Updated category/subcategory structure:
  * Bosch Accessories: Three Filters, Wiper, Battery, Brake Pad, Spark Plug, Other
  * Chemicals: T1, T3, Other
  * X-OWL: Brake Pad, Other
- Independent categories remain separate: Tire, Engine Oil, Chemicals, Window Film, Car Beauty.
- Existing leads, historical records, and historical filtering behavior are preserved.

5) Language & UI Consistency
- All updates above are synchronized across 4 languages:
  English / Simplified Chinese / Traditional Chinese (HK) / Bahasa Indonesia.
- Mobile adaptation was aligned for key updated pages.

6) Stability & Cleanup
- Cleaned redundant local build/cache artifacts.
- Final calibration completed (build/test/preview checks).
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
  'release-v1.3.1-2026-06-01',
  false
from release_content rc
where not exists (
  select 1
  from public.notifications n
  where n.user_id = rc.user_id
    and n.type = 'system_announcement'
    and n.entity_type = 'system_release_note'
    and n.entity_id = 'release-v1.3.1-2026-06-01'
);
