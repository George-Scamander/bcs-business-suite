begin;

-- Add X-OWL as an independent sales category without rewriting historical
-- category values or existing subcategory records.
alter table if exists public.sales_order_items
  drop constraint if exists sales_order_items_category_check;

alter table if exists public.sales_order_items
  add constraint sales_order_items_category_check
  check (
    category in (
      'ENGINE_OIL',
      'CHEMICAL',
      'TIRE',
      'WIPER',
      'THREE_FILTERS',
      'BATTERY',
      'BRAKE_PAD',
      'CAR_BEAUTY',
      'WINDOW_FILM',
      'BOSCH_ACCESSORY',
      'X_OWL'
    )
  );

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
      'CHEMICAL_OTHER',
      'X_OWL_BRAKE_PAD',
      'X_OWL_OTHER'
    )
  );

commit;
