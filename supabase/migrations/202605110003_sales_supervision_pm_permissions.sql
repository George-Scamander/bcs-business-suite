-- Allow PM role to manage sales orders/items in supervision and recently deleted modules.

begin;

drop policy if exists sales_orders_update_policy on public.sales_orders;
create policy sales_orders_update_policy
on public.sales_orders
for update to authenticated
using (
  public.is_super_admin(auth.uid())
  or public.has_role_code('project_manager', auth.uid())
  or bd_user_id = auth.uid()
)
with check (
  public.is_super_admin(auth.uid())
  or public.has_role_code('project_manager', auth.uid())
  or bd_user_id = auth.uid()
);

drop policy if exists sales_orders_delete_policy on public.sales_orders;
create policy sales_orders_delete_policy
on public.sales_orders
for delete to authenticated
using (
  public.is_super_admin(auth.uid())
  or public.has_role_code('project_manager', auth.uid())
  or bd_user_id = auth.uid()
);

drop policy if exists sales_order_items_insert_policy on public.sales_order_items;
create policy sales_order_items_insert_policy
on public.sales_order_items
for insert to authenticated
with check (
  exists (
    select 1
    from public.sales_orders o
    where o.id = sales_order_items.sales_order_id
      and (
        public.is_super_admin(auth.uid())
        or public.has_role_code('project_manager', auth.uid())
        or (
          o.bd_user_id = auth.uid()
          and public.has_permission('leads.write', auth.uid())
        )
      )
  )
);

drop policy if exists sales_order_items_update_policy on public.sales_order_items;
create policy sales_order_items_update_policy
on public.sales_order_items
for update to authenticated
using (
  exists (
    select 1
    from public.sales_orders o
    where o.id = sales_order_items.sales_order_id
      and (
        public.is_super_admin(auth.uid())
        or public.has_role_code('project_manager', auth.uid())
        or o.bd_user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.sales_orders o
    where o.id = sales_order_items.sales_order_id
      and (
        public.is_super_admin(auth.uid())
        or public.has_role_code('project_manager', auth.uid())
        or o.bd_user_id = auth.uid()
      )
  )
);

drop policy if exists sales_order_items_delete_policy on public.sales_order_items;
create policy sales_order_items_delete_policy
on public.sales_order_items
for delete to authenticated
using (
  exists (
    select 1
    from public.sales_orders o
    where o.id = sales_order_items.sales_order_id
      and (
        public.is_super_admin(auth.uid())
        or public.has_role_code('project_manager', auth.uid())
        or o.bd_user_id = auth.uid()
      )
  )
);

commit;
