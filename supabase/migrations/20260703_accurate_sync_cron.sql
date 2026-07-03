-- 啟用 pg_cron 擴充（需要在 Supabase Dashboard > Extensions 先啟用）
-- 每小時整點自動執行 accurate-sync Edge Function

select cron.schedule(
  'accurate-hourly-sync',
  '0 * * * *',
  $$
  select
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/accurate-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    )
  $$
);
