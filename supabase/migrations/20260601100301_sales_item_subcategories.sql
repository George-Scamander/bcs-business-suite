begin;

-- Preserve historical category values. New records may optionally store a
-- second-level classification for grouped Bosch accessories and chemicals.
alter table if exists public.sales_order_items
  add column if not exists subcategory text;

alter table if exists public.sales_order_items
  drop constraint if exists sales_order_items_subcategory_check;

alter table if exists public.sales_order_items
  add constraint sales_order_items_subcategory_check
  check (
    subcategory is null
    or subcategory in (
      'BOSCH_THREE_FILTERS',
      'BOSCH_WIPER',
      'BOSCH_BATTERY',
      'BOSCH_BRAKE_PAD',
      'BOSCH_SPARK_PLUG',
      'BOSCH_OTHER',
      'CHEMICAL_T1',
      'CHEMICAL_T3',
      'CHEMICAL_OTHER'
    )
  );

create index if not exists idx_sales_order_items_subcategory
  on public.sales_order_items (subcategory)
  where subcategory is not null;

commit;
