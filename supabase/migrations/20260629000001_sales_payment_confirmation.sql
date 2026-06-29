-- Task: PMO payment confirmation for sales orders
-- Adds payment_confirmed_at and payment_confirmed_by columns to sales_orders,
-- plus a secure RPC function that only super_admin and project_manager can call.

begin;

-- 1. Add columns (idempotent)
alter table if exists public.sales_orders
  add column if not exists payment_confirmed_at  timestamptz default null,
  add column if not exists payment_confirmed_by  uuid references public.profiles (id) on delete set null default null;

-- 2. Index for quick lookup of confirmed/unconfirmed orders
create index if not exists idx_sales_orders_payment_confirmed
  on public.sales_orders (payment_confirmed_at)
  where payment_confirmed_at is not null;

-- 3. RPC: toggle payment confirmation
--    - super_admin or project_manager only
--    - if already confirmed  → clears the confirmation (undo)
--    - if not yet confirmed  → stamps the current user and time
create or replace function public.confirm_sales_order_payment(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_already_confirmed boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Only super_admin or project_manager may confirm payment
  if not (
    public.is_super_admin(v_user_id)
    or public.has_role_code('project_manager', v_user_id)
  ) then
    raise exception 'Permission denied: only super_admin or project_manager can confirm payment';
  end if;

  -- Check the order exists (and is not deleted)
  if not exists (
    select 1
    from public.sales_orders
    where id = p_order_id
      and deleted_at is null
  ) then
    raise exception 'Sales order not found';
  end if;

  -- Check current confirmation state
  select (payment_confirmed_at is not null)
    into v_already_confirmed
  from public.sales_orders
  where id = p_order_id;

  if v_already_confirmed then
    -- Undo confirmation
    update public.sales_orders
    set payment_confirmed_at = null,
        payment_confirmed_by = null,
        updated_by            = v_user_id,
        updated_at            = timezone('utc', now())
    where id = p_order_id;
  else
    -- Confirm payment
    update public.sales_orders
    set payment_confirmed_at = timezone('utc', now()),
        payment_confirmed_by = v_user_id,
        updated_by           = v_user_id,
        updated_at           = timezone('utc', now())
    where id = p_order_id;
  end if;
end;
$$;

grant execute on function public.confirm_sales_order_payment(uuid) to authenticated;

commit;
