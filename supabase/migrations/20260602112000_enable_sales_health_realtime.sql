begin;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sales_orders'
  ) then
    alter publication supabase_realtime add table public.sales_orders;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sales_order_items'
  ) then
    alter publication supabase_realtime add table public.sales_order_items;
  end if;
end;
$$;

commit;
