create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('shk-weekly-email-reminders')
where exists (
  select 1 from cron.job where jobname = 'shk-weekly-email-reminders'
);

select cron.schedule(
  'shk-weekly-email-reminders',
  '0 9 * * 1',
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

select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname = 'shk-weekly-email-reminders';
