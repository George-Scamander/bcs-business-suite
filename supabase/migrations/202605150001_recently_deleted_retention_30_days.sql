-- Auto-clean recently deleted records after 30 days.
-- Scope: leads / projects / sales_orders / onboard_merchants

create or replace function public.cleanup_expired_recently_deleted(p_retention_days integer default 30)
returns table (
  leads_deleted integer,
  projects_deleted integer,
  sales_deleted integer,
  merchants_deleted integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := timezone('utc', now()) - make_interval(days => greatest(p_retention_days, 1));
begin
  delete from public.leads
  where deleted_at is not null
    and deleted_at <= v_cutoff;
  get diagnostics leads_deleted = row_count;

  delete from public.projects
  where deleted_at is not null
    and deleted_at <= v_cutoff;
  get diagnostics projects_deleted = row_count;

  delete from public.sales_orders
  where deleted_at is not null
    and deleted_at <= v_cutoff;
  get diagnostics sales_deleted = row_count;

  delete from public.onboard_merchants
  where deleted_at is not null
    and deleted_at <= v_cutoff;
  get diagnostics merchants_deleted = row_count;

  return next;
end;
$$;

grant execute on function public.cleanup_expired_recently_deleted(integer) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'cleanup_expired_recently_deleted_30d';

    perform cron.schedule(
      'cleanup_expired_recently_deleted_30d',
      '13 2 * * *',
      $$select public.cleanup_expired_recently_deleted(30);$$
    );
  end if;
end;
$$;
