begin;

-- Fix: the 20260630 migration updated the RPC function to accept CONSIGNMENT
-- but forgot to update the two table-level CHECK constraints on sales_orders.
-- This migration corrects both constraints.

-- 1. Allow CONSIGNMENT as a valid payment_method value
alter table public.sales_orders
  drop constraint if exists sales_orders_payment_method_check;

alter table public.sales_orders
  add constraint sales_orders_payment_method_check
  check (payment_method in ('TOP', 'CASH', 'CONSIGNMENT'));

-- 2. Update consistency rule: CONSIGNMENT always has payment_top_term = '30_DAYS'
alter table public.sales_orders
  drop constraint if exists sales_orders_payment_terms_consistency_check;

alter table public.sales_orders
  add constraint sales_orders_payment_terms_consistency_check
  check (
    (payment_method = 'TOP'         and payment_top_term in ('30_DAYS', '60_DAYS'))
    or (payment_method = 'CASH'       and payment_top_term is null)
    or (payment_method = 'CONSIGNMENT' and payment_top_term = '30_DAYS')
  );

commit;
