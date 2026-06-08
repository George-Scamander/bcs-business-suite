begin;

-- Merchant health is derived from existing sales records. It is intentionally
-- read-only: the lead pool always reflects the latest order data.
create index if not exists idx_sales_orders_health_lead_sold_at
  on public.sales_orders (lead_id, sold_at desc)
  where deleted_at is null and lead_id is not null;

create or replace function public.list_lead_merchant_health()
returns table (
  lead_id uuid,
  health_score integer,
  health_tier text,
  spend_score numeric,
  frequency_score numeric,
  category_score numeric,
  trend_score numeric,
  spend_30 numeric,
  spend_prev_30 numeric,
  orders_30 integer,
  orders_prev_30 integer,
  tire_spend_30 numeric,
  tire_share_30 numeric,
  last_purchase_at timestamptz,
  risk_reasons text[]
)
language sql
stable
security invoker
set search_path = public
as $$
  with order_amounts as (
    select
      so.id,
      so.lead_id,
      so.sold_at,
      coalesce(sum(soi.quantity * coalesce(soi.unit_price, 0)), 0)::numeric as amount,
      coalesce(sum(soi.quantity * coalesce(soi.unit_price, 0))
        filter (where soi.category = 'TIRE'), 0)::numeric as tire_amount
    from public.sales_orders so
    left join public.sales_order_items soi on soi.sales_order_id = so.id
    where so.deleted_at is null
      and so.lead_id is not null
    group by so.id, so.lead_id, so.sold_at
  ),
  lead_orders as (
    select
      oa.lead_id,
      coalesce(sum(oa.amount) filter (
        where oa.sold_at >= current_date - interval '30 days'
      ), 0)::numeric as spend_30,
      coalesce(sum(oa.amount) filter (
        where oa.sold_at >= current_date - interval '60 days'
          and oa.sold_at < current_date - interval '30 days'
      ), 0)::numeric as spend_prev_30,
      count(*) filter (
        where oa.sold_at >= current_date - interval '30 days'
      )::integer as orders_30,
      count(*) filter (
        where oa.sold_at >= current_date - interval '60 days'
          and oa.sold_at < current_date - interval '30 days'
      )::integer as orders_prev_30,
      coalesce(sum(oa.tire_amount) filter (
        where oa.sold_at >= current_date - interval '30 days'
      ), 0)::numeric as tire_spend_30,
      max(oa.sold_at) as last_purchase_at
    from order_amounts oa
    group by oa.lead_id
  ),
  category_last_purchase as (
    select
      so.lead_id,
      max(so.sold_at) filter (where soi.category = 'ENGINE_OIL') as engine_oil_last_at,
      max(so.sold_at) filter (
        where soi.category = 'THREE_FILTERS'
          or soi.subcategory = 'BOSCH_THREE_FILTERS'
      ) as three_filters_last_at,
      max(so.sold_at) filter (where soi.category = 'CHEMICAL') as chemical_last_at,
      max(so.sold_at) filter (where soi.category = 'CAR_BEAUTY') as car_beauty_last_at,
      max(so.sold_at) filter (where soi.category = 'TIRE') as tire_last_at
    from public.sales_orders so
    join public.sales_order_items soi on soi.sales_order_id = so.id
    where so.deleted_at is null
      and so.lead_id is not null
    group by so.lead_id
  ),
  ranked as (
    select
      lo.*,
      clp.engine_oil_last_at,
      clp.three_filters_last_at,
      clp.chemical_last_at,
      clp.car_beauty_last_at,
      clp.tire_last_at,
      count(*) over () as merchant_count,
      percent_rank() over (order by lo.spend_30) as spend_percent_rank
    from lead_orders lo
    left join category_last_purchase clp on clp.lead_id = lo.lead_id
  ),
  dimensions as (
    select
      ranked.*,
      case
        when merchant_count = 1 then 30::numeric
        else round((spend_percent_rank * 30)::numeric, 1)
      end as spend_score,
      case
        when orders_30 = 0 then 0::numeric
        when orders_prev_30 = 0 then 25::numeric
        when orders_30::numeric / orders_prev_30 >= 1 then 25::numeric
        when orders_30::numeric / orders_prev_30 >= 0.7 then 18::numeric
        when orders_30::numeric / orders_prev_30 >= 0.4 then 10::numeric
        else 3::numeric
      end as frequency_score,
      (
        case when engine_oil_last_at is null then 0 when current_date - engine_oil_last_at::date <= 12 then 5 when current_date - engine_oil_last_at::date <= 20 then 2.5 else 0 end +
        case when three_filters_last_at is null then 0 when current_date - three_filters_last_at::date <= 12 then 5 when current_date - three_filters_last_at::date <= 20 then 2.5 else 0 end +
        case when chemical_last_at is null then 0 when current_date - chemical_last_at::date <= 12 then 5 when current_date - chemical_last_at::date <= 20 then 2.5 else 0 end +
        case when car_beauty_last_at is null then 0 when current_date - car_beauty_last_at::date <= 12 then 5 when current_date - car_beauty_last_at::date <= 20 then 2.5 else 0 end +
        case when tire_last_at is null then 0 when current_date - tire_last_at::date <= 20 then 5 when current_date - tire_last_at::date <= 35 then 2.5 else 0 end
      )::numeric as category_score,
      case
        when spend_30 = 0 then 0::numeric
        when spend_prev_30 = 0 then 20::numeric
        when (spend_30 - spend_prev_30) / spend_prev_30 >= 0.10 then 20::numeric
        when (spend_30 - spend_prev_30) / spend_prev_30 >= -0.10 then 15::numeric
        when (spend_30 - spend_prev_30) / spend_prev_30 >= -0.30 then 8::numeric
        else 0::numeric
      end as trend_score
    from ranked
  ),
  scored as (
    select
      dimensions.*,
      round(spend_score + frequency_score + category_score + trend_score)::integer as health_score
    from dimensions
  )
  select
    scored.lead_id,
    scored.health_score,
    case
      when scored.health_score >= 80 then 'STAR'
      when scored.health_score >= 60 then 'NORMAL'
      else 'RISK'
    end as health_tier,
    scored.spend_score,
    scored.frequency_score,
    scored.category_score,
    scored.trend_score,
    scored.spend_30,
    scored.spend_prev_30,
    scored.orders_30,
    scored.orders_prev_30,
    scored.tire_spend_30,
    case when scored.spend_30 > 0
      then round(scored.tire_spend_30 / scored.spend_30 * 100, 1)
      else 0
    end as tire_share_30,
    scored.last_purchase_at,
    array_remove(array[
      case when scored.spend_30 = 0 then 'NO_PURCHASE_LAST_30_DAYS' end,
      case when scored.spend_prev_30 > 0 and scored.spend_30 < scored.spend_prev_30 * 0.7 then 'SPEND_DECLINED' end,
      case when scored.orders_30 = 0 then 'LOW_ORDER_FREQUENCY' end,
      case when scored.category_score < 15 then 'HIGH_FREQUENCY_CATEGORY_GAP' end
    ], null)::text[] as risk_reasons
  from scored
  order by scored.health_score desc, scored.lead_id;
$$;

grant execute on function public.list_lead_merchant_health() to authenticated;

commit;
