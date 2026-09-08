create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('shk-monthly-database-backup')
where exists (
  select 1 from cron.job where jobname = 'shk-monthly-database-backup'
);

select cron.schedule(
  'shk-monthly-database-backup',
  '0 2 1 * *',
  $$
  select net.http_post(
    url := 'https://hrvbnayanswugfwdfhto.supabase.co/functions/v1/database-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY',
      'apikey', 'YOUR_SUPABASE_ANON_KEY',
      'x-shk-cron-secret', 'YOUR_BACKUP_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.unschedule('shk-daily-email-reminders')
where exists (
  select 1 from cron.job where jobname = 'shk-daily-email-reminders'
);

select cron.schedule(
  'shk-daily-email-reminders',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://hrvbnayanswugfwdfhto.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY',
      'apikey', 'YOUR_SUPABASE_ANON_KEY',
      'x-shk-cron-secret', 'YOUR_REMINDER_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
