begin;

alter table if exists public.sales_orders
  add column if not exists payment_method text not null default 'CASH',
  add column if not exists payment_top_term text;

update public.sales_orders
set payment_method = 'CASH'
where payment_method is null;

alter table if exists public.sales_orders
  drop constraint if exists sales_orders_payment_method_check;

alter table if exists public.sales_orders
  add constraint sales_orders_payment_method_check
  check (payment_method in ('TOP', 'CASH'));

alter table if exists public.sales_orders
  drop constraint if exists sales_orders_payment_top_term_check;

alter table if exists public.sales_orders
  add constraint sales_orders_payment_top_term_check
  check (payment_top_term is null or payment_top_term in ('30_DAYS', '60_DAYS'));

alter table if exists public.sales_orders
  drop constraint if exists sales_orders_payment_terms_consistency_check;

alter table if exists public.sales_orders
  add constraint sales_orders_payment_terms_consistency_check
  check (
    (payment_method = 'TOP' and payment_top_term in ('30_DAYS', '60_DAYS'))
    or (payment_method = 'CASH' and payment_top_term is null)
  );

commit;
