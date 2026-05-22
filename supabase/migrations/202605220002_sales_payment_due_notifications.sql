begin;

create or replace function public.generate_sales_payment_due_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_count integer := 0;
begin
  with pm_admin_users as (
    select distinct urr.user_id
    from public.user_role_relations urr
    join public.roles r on r.id = urr.role_id
    where r.code in ('project_manager', 'super_admin')
  ),
  due_orders as (
    select
      so.id as order_id,
      so.order_no,
      so.company_name,
      so.bd_user_id,
      case so.payment_top_term
        when '60_DAYS' then so.sold_at + interval '60 days'
        else so.sold_at + interval '30 days'
      end as due_at
    from public.sales_orders so
    where so.deleted_at is null
      and so.payment_method = 'TOP'
      and so.payment_top_term in ('30_DAYS', '60_DAYS')
  ),
  due_soon_orders as (
    select *
    from due_orders
    where due_at::date between current_date + 1 and current_date + 7
  ),
  recipient_rows as (
    select
      dso.order_id,
      dso.order_no,
      dso.company_name,
      dso.due_at,
      recipient.user_id
    from due_soon_orders dso
    cross join lateral (
      select dso.bd_user_id as user_id
      union
      select pau.user_id from pm_admin_users pau
    ) recipient
  ),
  localized_rows as (
    select
      rr.user_id,
      rr.order_id,
      rr.order_no,
      rr.company_name,
      rr.due_at,
      p.locale,
      (rr.order_id::text || ':' || to_char(rr.due_at at time zone 'utc', 'YYYYMMDD')) as entity_id_key,
      greatest(0, (rr.due_at::date - current_date)) as days_left
    from recipient_rows rr
    join public.profiles p on p.id = rr.user_id
    where p.is_active = true
  ),
  inserted_rows as (
    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      entity_type,
      entity_id,
      is_read
    )
    select
      lr.user_id,
      'sales_top_due_reminder',
      case lr.locale
        when 'zh-CN' then '销售回款催办提醒'
        when 'zh-HK' then '銷售回款催辦提醒'
        when 'id-ID' then 'Pengingat penagihan pembayaran penjualan'
        else 'Sales payment collection reminder'
      end,
      case lr.locale
        when 'zh-CN' then
          '销售单 ' || coalesce(lr.order_no, '-') ||
          '（' || coalesce(lr.company_name, '-') || '）TOP账期将于 ' ||
          to_char(lr.due_at at time zone 'utc', 'YYYY-MM-DD') ||
          ' 到期，请提前催办（剩余 ' || lr.days_left::text || ' 天）。'
        when 'zh-HK' then
          '銷售單 ' || coalesce(lr.order_no, '-') ||
          '（' || coalesce(lr.company_name, '-') || '）TOP賬期將於 ' ||
          to_char(lr.due_at at time zone 'utc', 'YYYY-MM-DD') ||
          ' 到期，請提前催帳（剩餘 ' || lr.days_left::text || ' 天）。'
        when 'id-ID' then
          'Order ' || coalesce(lr.order_no, '-') ||
          ' (' || coalesce(lr.company_name, '-') || ') akan jatuh tempo TOP pada ' ||
          to_char(lr.due_at at time zone 'utc', 'YYYY-MM-DD') ||
          '. Mohon lakukan penagihan lebih awal (sisa ' || lr.days_left::text || ' hari).'
        else
          'Sales order ' || coalesce(lr.order_no, '-') ||
          ' (' || coalesce(lr.company_name, '-') || ') TOP term is due on ' ||
          to_char(lr.due_at at time zone 'utc', 'YYYY-MM-DD') ||
          '. Please start collection follow-up (remaining ' || lr.days_left::text || ' day(s)).'
      end,
      'sales_order_payment_due',
      lr.entity_id_key,
      false
    from localized_rows lr
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = lr.user_id
        and n.type = 'sales_top_due_reminder'
        and n.entity_type = 'sales_order_payment_due'
        and n.entity_id = lr.entity_id_key
    )
    returning 1
  )
  select count(*) into v_inserted_count
  from inserted_rows;

  return v_inserted_count;
end;
$$;

grant execute on function public.generate_sales_payment_due_notifications() to authenticated;

commit;
