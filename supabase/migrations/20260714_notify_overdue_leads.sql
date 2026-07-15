-- Scheduled function: notify BDs and super_admins of overdue leads.
-- Overdue = status IN ('NEW','TO_FOLLOW','FOLLOWING','NEGOTIATING')
--           AND (last_followup_at IS NULL OR last_followup_at < now() - 7 days)
-- Runs daily at UTC 02:00 (= Jakarta WIB 09:00).
-- Notification types: LEAD_OVERDUE_BD (per-BD) · LEAD_OVERDUE_ADMIN (team total)

begin;

create or replace function public.notify_overdue_leads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date_key      text    := current_date::text;
  v_total_overdue bigint;
  v_cnt1          integer := 0;
  v_cnt2          integer := 0;
begin
  -- Count total overdue leads for early-exit and admin message
  select count(*)
    into v_total_overdue
    from public.leads l
   where l.deleted_at is null
     and l.assigned_bd_id is not null
     and l.status in ('NEW', 'TO_FOLLOW', 'FOLLOWING', 'NEGOTIATING')
     and (
       l.last_followup_at is null
       or l.last_followup_at < current_timestamp - interval '7 days'
     );

  if v_total_overdue = 0 then
    return 0;
  end if;

  -- 1. Notify each responsible BD with their own overdue count
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, is_read)
  select
    sub.assigned_bd_id,
    'LEAD_OVERDUE_BD',
    case sub.locale
      when 'zh-CN' then '跟进逾期提醒'
      when 'zh-HK' then '跟進逾期提醒'
      when 'id-ID' then 'Pengingat Tindak Lanjut Terlambat'
      else 'Overdue Follow-Up Reminder'
    end,
    case sub.locale
      when 'zh-CN' then '您有 ' || sub.overdue_count::text || ' 条线索超过 7 天未跟进，请尽快处理。'
      when 'zh-HK' then '您有 ' || sub.overdue_count::text || ' 條線索超過 7 天未跟進，請盡快處理。'
      when 'id-ID' then 'Anda memiliki ' || sub.overdue_count::text || ' prospek yang belum ditindaklanjuti lebih dari 7 hari. Mohon segera ditangani.'
      else 'You have ' || sub.overdue_count::text || ' lead(s) with no follow-up in over 7 days. Please take action.'
    end,
    'lead_overdue',
    'overdue_leads:bd:' || v_date_key,
    false
  from (
    select
      l.assigned_bd_id,
      count(*)  as overdue_count,
      p.locale
    from public.leads l
    join public.profiles p on p.id = l.assigned_bd_id
    where l.deleted_at is null
      and l.assigned_bd_id is not null
      and l.status in ('NEW', 'TO_FOLLOW', 'FOLLOWING', 'NEGOTIATING')
      and (
        l.last_followup_at is null
        or l.last_followup_at < current_timestamp - interval '7 days'
      )
      and p.is_active = true
    group by l.assigned_bd_id, p.locale
  ) sub
  where not exists (
    select 1
    from public.notifications n
    where n.user_id = sub.assigned_bd_id
      and n.type = 'LEAD_OVERDUE_BD'
      and n.entity_id = 'overdue_leads:bd:' || v_date_key
  );

  get diagnostics v_cnt1 = row_count;

  -- 2. Notify all super_admins with the team-wide total
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, is_read)
  select
    p.id,
    'LEAD_OVERDUE_ADMIN',
    case p.locale
      when 'zh-CN' then '团队逾期线索警报'
      when 'zh-HK' then '團隊逾期線索警報'
      when 'id-ID' then 'Peringatan Prospek Terlambat Tim'
      else 'Team Overdue Leads Alert'
    end,
    case p.locale
      when 'zh-CN' then '目前共有 ' || v_total_overdue::text || ' 条线索超过 7 天未跟进，请协助督促 BD 跟进。'
      when 'zh-HK' then '目前共有 ' || v_total_overdue::text || ' 條線索超過 7 天未跟進，請協助督促 BD 跟進。'
      when 'id-ID' then 'Saat ini ada ' || v_total_overdue::text || ' prospek yang belum ditindaklanjuti lebih dari 7 hari. Mohon ingatkan BD untuk segera menangani.'
      else 'There are currently ' || v_total_overdue::text || ' lead(s) with no follow-up in over 7 days. Please follow up with the BD team.'
    end,
    'lead_overdue',
    'overdue_leads:admin:' || v_date_key,
    false
  from public.user_role_relations urr
  join public.roles r on r.id = urr.role_id
  join public.profiles p on p.id = urr.user_id
  where r.code = 'super_admin'
    and p.is_active = true
  and not exists (
    select 1
    from public.notifications n
    where n.user_id = p.id
      and n.type = 'LEAD_OVERDUE_ADMIN'
      and n.entity_id = 'overdue_leads:admin:' || v_date_key
  );

  get diagnostics v_cnt2 = row_count;

  return v_cnt1 + v_cnt2;
end;
$$;

grant execute on function public.notify_overdue_leads() to authenticated;

commit;

-- Schedule daily at UTC 02:00 (= Jakarta WIB 09:00)
do $outer$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'notify_overdue_leads_daily';

    perform cron.schedule(
      'notify_overdue_leads_daily',
      '0 2 * * *',
      'select public.notify_overdue_leads();'
    );
  end if;
end;
$outer$;
