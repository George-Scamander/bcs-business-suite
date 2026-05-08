-- Sales orders module:
-- 1) BD can create sales orders with structured items
-- 2) Auto-create lead (SP prefix) when company is not present in lead pool
-- 3) PMO and Super Admin can supervise sales orders

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default ('SO-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6))),
  company_name text not null,
  lead_id uuid references public.leads (id) on delete set null,
  bd_user_id uuid not null references public.profiles (id) on delete restrict,
  sold_at timestamptz not null default timezone('utc', now()),
  note text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders (id) on delete cascade,
  category text not null check (category in ('TIRE', 'ENGINE_OIL', 'WINDOW_FILM', 'BOSCH_ACCESSORY')),
  product_name text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(14, 2) check (unit_price is null or unit_price >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_sales_orders_bd_user_created on public.sales_orders (bd_user_id, created_at desc);
create index if not exists idx_sales_orders_company on public.sales_orders (company_name);
create index if not exists idx_sales_orders_sold_at on public.sales_orders (sold_at desc);
create index if not exists idx_sales_order_items_order on public.sales_order_items (sales_order_id);

create or replace function public.has_role_code(p_role_code text, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_relations urr
    join public.roles r on r.id = urr.role_id
    where urr.user_id = target_user_id
      and r.code = p_role_code
  )
$$;

create or replace function public.create_sales_order_with_auto_lead(
  p_company_name text,
  p_sold_at timestamptz default null,
  p_note text default null,
  p_items jsonb default '[]'::jsonb
)
returns table (
  order_id uuid,
  order_no text,
  lead_id uuid,
  lead_code text,
  lead_created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_company text := trim(coalesce(p_company_name, ''));
  v_sold_at timestamptz := coalesce(p_sold_at, timezone('utc', now()));
  v_lead_id uuid;
  v_lead_code text;
  v_order_id uuid;
  v_order_no text;
  v_item jsonb;
  v_category text;
  v_product_name text;
  v_quantity integer;
  v_unit_price numeric(14, 2);
  v_lead_created boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_permission('leads.write', v_user_id) then
    raise exception 'Permission denied';
  end if;

  if v_company = '' then
    raise exception 'Company name is required';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one sales item is required';
  end if;

  select l.id, l.lead_code
    into v_lead_id, v_lead_code
  from public.leads l
  where l.deleted_at is null
    and public.normalize_company_name(l.company_name) = public.normalize_company_name(v_company)
  order by l.created_at desc
  limit 1;

  if v_lead_id is null then
    v_lead_created := true;
    v_lead_code := 'SP-' || to_char(v_sold_at at time zone 'utc', 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));

    insert into public.leads (
      lead_code,
      company_name,
      source,
      status,
      assigned_bd_id,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      v_lead_code,
      v_company,
      'SALES_ORDER',
      'NEW',
      v_user_id,
      v_user_id,
      v_user_id,
      v_sold_at,
      timezone('utc', now())
    )
    returning id into v_lead_id;
  end if;

  insert into public.sales_orders (
    company_name,
    lead_id,
    bd_user_id,
    sold_at,
    note,
    created_by,
    updated_by
  )
  values (
    v_company,
    v_lead_id,
    v_user_id,
    v_sold_at,
    p_note,
    v_user_id,
    v_user_id
  )
  returning id, order_no into v_order_id, v_order_no;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    v_category := upper(trim(coalesce(v_item ->> 'category', '')));
    if v_category not in ('TIRE', 'ENGINE_OIL', 'WINDOW_FILM', 'BOSCH_ACCESSORY') then
      raise exception 'Unsupported sales category: %', coalesce(v_item ->> 'category', '');
    end if;

    v_product_name := nullif(trim(coalesce(v_item ->> 'product_name', '')), '');
    v_quantity := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));
    v_unit_price := nullif(trim(coalesce(v_item ->> 'unit_price', '')), '')::numeric(14, 2);

    insert into public.sales_order_items (
      sales_order_id,
      category,
      product_name,
      quantity,
      unit_price
    )
    values (
      v_order_id,
      v_category,
      v_product_name,
      v_quantity,
      v_unit_price
    );
  end loop;

  perform public.record_operation_log(
    'sales',
    'sales_orders',
    v_order_id::text,
    'create_sales_order',
    null,
    jsonb_build_object(
      'order_no', v_order_no,
      'company_name', v_company,
      'lead_id', v_lead_id,
      'lead_code', v_lead_code,
      'lead_created', v_lead_created
    ),
    null
  );

  return query
  select v_order_id, v_order_no, v_lead_id, v_lead_code, v_lead_created;
end;
$$;

grant execute on function public.has_role_code(text, uuid) to authenticated;
grant execute on function public.create_sales_order_with_auto_lead(text, timestamptz, text, jsonb) to authenticated;

grant select, insert, update, delete on public.sales_orders to authenticated;
grant select, insert, update, delete on public.sales_order_items to authenticated;

alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;

drop policy if exists sales_orders_select_policy on public.sales_orders;
create policy sales_orders_select_policy
on public.sales_orders
for select to authenticated
using (
  public.is_super_admin(auth.uid())
  or public.has_role_code('project_manager', auth.uid())
  or bd_user_id = auth.uid()
);

drop policy if exists sales_orders_insert_policy on public.sales_orders;
create policy sales_orders_insert_policy
on public.sales_orders
for insert to authenticated
with check (
  auth.uid() is not null
  and (
    public.is_super_admin(auth.uid())
    or (
      bd_user_id = auth.uid()
      and public.has_permission('leads.write', auth.uid())
    )
  )
);

drop policy if exists sales_orders_update_policy on public.sales_orders;
create policy sales_orders_update_policy
on public.sales_orders
for update to authenticated
using (
  public.is_super_admin(auth.uid())
  or bd_user_id = auth.uid()
)
with check (
  public.is_super_admin(auth.uid())
  or bd_user_id = auth.uid()
);

drop policy if exists sales_orders_delete_policy on public.sales_orders;
create policy sales_orders_delete_policy
on public.sales_orders
for delete to authenticated
using (
  public.is_super_admin(auth.uid())
  or bd_user_id = auth.uid()
);

drop policy if exists sales_order_items_select_policy on public.sales_order_items;
create policy sales_order_items_select_policy
on public.sales_order_items
for select to authenticated
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
        or o.bd_user_id = auth.uid()
      )
  )
);

