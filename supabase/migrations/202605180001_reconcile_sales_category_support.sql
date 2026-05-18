begin;

-- Reconcile sales category support across environments where old RPC/check constraints may still exist.
-- Allowed categories:
-- ENGINE_OIL, CHEMICAL, TIRE, WIPER, THREE_FILTERS, BATTERY, BRAKE_PAD, CAR_BEAUTY, WINDOW_FILM, BOSCH_ACCESSORY

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
      'BOSCH_ACCESSORY'
    )
  );

create or replace function public.create_sales_order_with_auto_lead(
  p_company_name text,
  p_sold_at timestamptz default null,
  p_note text default null,
  p_items jsonb default '[]'::jsonb,
  p_onboard_merchant_id uuid default null
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
  v_activity_detail text;
  v_onboard_merchant_id uuid := p_onboard_merchant_id;
  v_merchant record;
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

  if v_onboard_merchant_id is not null then
    select om.*
      into v_merchant
    from public.onboard_merchants om
    where om.id = v_onboard_merchant_id
      and om.deleted_at is null
    limit 1;

    if not found then
      raise exception 'Onboard merchant not found';
    end if;

    if v_company = '' then
      v_company := trim(coalesce(v_merchant.company_name, ''));
    end if;

    if v_merchant.lead_id is not null then
      select l.id, l.lead_code
        into v_lead_id, v_lead_code
      from public.leads l
      where l.id = v_merchant.lead_id
        and l.deleted_at is null
      limit 1;
    end if;
  end if;

  if v_company = '' then
    raise exception 'Company name is required';
  end if;

  if v_onboard_merchant_id is null then
    select om.*
      into v_merchant
    from public.onboard_merchants om
    where om.deleted_at is null
      and public.normalize_company_name(om.company_name) = public.normalize_company_name(v_company)
    order by case when om.bd_owner_id = v_user_id then 0 else 1 end,
             om.updated_at desc
    limit 1;

    if found then
      v_onboard_merchant_id := v_merchant.id;

      if v_merchant.lead_id is not null then
        select l.id, l.lead_code
          into v_lead_id, v_lead_code
        from public.leads l
        where l.id = v_merchant.lead_id
          and l.deleted_at is null
        limit 1;
      end if;
    end if;
  end if;

  if p_items is null
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one sales item is required';
  end if;

  if v_lead_id is null then
    select l.id, l.lead_code
      into v_lead_id, v_lead_code
    from public.leads l
    where l.deleted_at is null
      and public.normalize_company_name(l.company_name) = public.normalize_company_name(v_company)
    order by l.created_at desc
    limit 1;
  end if;

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

  if v_onboard_merchant_id is not null then
    update public.onboard_merchants
    set lead_id = coalesce(lead_id, v_lead_id),
        updated_by = v_user_id,
        updated_at = timezone('utc', now())
    where id = v_onboard_merchant_id;
  end if;

  insert into public.sales_orders as so (
    company_name,
    lead_id,
    onboard_merchant_id,
    bd_user_id,
    sold_at,
    note,
    created_by,
    updated_by
  )
  values (
    v_company,
    v_lead_id,
    v_onboard_merchant_id,
    v_user_id,
    v_sold_at,
    p_note,
    v_user_id,
    v_user_id
  )
  returning so.id, so.order_no into v_order_id, v_order_no;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    v_category := upper(trim(coalesce(v_item ->> 'category', '')));
    if v_category not in (
      'ENGINE_OIL',
      'CHEMICAL',
      'TIRE',
      'WIPER',
      'THREE_FILTERS',
      'BATTERY',
      'BRAKE_PAD',
      'CAR_BEAUTY',
      'WINDOW_FILM',
      'BOSCH_ACCESSORY'
    ) then
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

  if v_onboard_merchant_id is not null then
    v_activity_detail := v_sales_summary;
    if nullif(trim(coalesce(p_note, '')), '') is not null then
      v_activity_detail := v_activity_detail || E'\nNote: ' || trim(coalesce(p_note, ''));
    end if;

    insert into public.onboard_merchant_activities (
      merchant_id,
      activity_type,
      status,
      title,
      detail,
      activity_at,
      related_sales_order_id,
      created_by,
      updated_by
    )
    values (
      v_onboard_merchant_id,
      'SALES_ORDER',
      'DONE',
      'Sales Order ' || v_order_no,
      v_activity_detail,
      v_sold_at,
      v_order_id,
      v_user_id,
      v_user_id
    );
  end if;

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
        'lead_created', v_lead_created,
        'onboard_merchant_id', v_onboard_merchant_id
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

grant execute on function public.create_sales_order_with_auto_lead(text, timestamptz, text, jsonb, uuid) to authenticated;

commit;
