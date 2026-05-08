-- Sales orders hardening patch:
-- 1) make sales-order create RPC resilient and permission-safe
-- 2) always sync sales activity to lead follow-up history
-- 3) ensure SALES_ORDER source dictionary exists for display

begin;

create or replace function public.normalize_company_name(p_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(p_name, ''))), '[[:space:][:punct:]_]+', '', 'g')
$$;

insert into public.role_permission_relations (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'leads.write'
where r.code in ('bd_user', 'project_manager')
on conflict do nothing;

insert into public.dictionary_items (dictionary_type, code, label, sort_order, is_active)
values ('lead_source', 'SALES_ORDER', 'Sales Order', 70, true)
on conflict (dictionary_type, code) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());

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
  v_item_summaries text[] := array[]::text[];
  v_sales_summary text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    public.has_permission('leads.write', v_user_id)
    or public.has_role_code('bd_user', v_user_id)
    or public.is_super_admin(v_user_id)
  ) then
    raise exception 'Permission denied';
  end if;

  if v_company = '' then
    raise exception 'Company name is required';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0 then
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

    begin
      v_quantity := nullif(trim(coalesce(v_item ->> 'quantity', '')), '')::integer;
    exception when others then
      v_quantity := 1;
    end;
    v_quantity := greatest(1, coalesce(v_quantity, 1));

    begin
      v_unit_price := nullif(trim(coalesce(v_item ->> 'unit_price', '')), '')::numeric(14, 2);
    exception when others then
      v_unit_price := null;
    end;

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

    v_item_summaries := array_append(
      v_item_summaries,
      coalesce(v_product_name, v_category) || ' x' || v_quantity::text
    );
  end loop;

  v_sales_summary := 'Sales Order ' || v_order_no || ': ' || array_to_string(v_item_summaries, ', ');

  insert into public.lead_followups (
    lead_id,
    followup_type,
    summary,
    followup_at,
    status_snapshot,
    created_by
  )
  values (
    v_lead_id,
    'VISIT',
    v_sales_summary,
    v_sold_at,
    'FOLLOWING',
    v_user_id
  );

  update public.leads
  set last_followup_at = v_sold_at,
      updated_at = timezone('utc', now()),
      updated_by = v_user_id
  where id = v_lead_id;

  begin
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
  exception when others then
    null;
  end;

  return query
  select v_order_id, v_order_no, v_lead_id, v_lead_code, v_lead_created;
end;
$$;

grant execute on function public.create_sales_order_with_auto_lead(text, timestamptz, text, jsonb) to authenticated;

commit;
