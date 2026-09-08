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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmJuYXlhbnN3dWdmd2RmaHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDkzMjUsImV4cCI6MjA5NjMyNTMyNX0.7MTtmrU3hpjToCJnt5Pf3NTmwLV6sPg0KI7SRvwTh5Y',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmJuYXlhbnN3dWdmd2RmaHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDkzMjUsImV4cCI6MjA5NjMyNTMyNX0.7MTtmrU3hpjToCJnt5Pf3NTmwLV6sPg0KI7SRvwTh5Y',
      'x-shk-cron-secret', 'shk_backup_secret_2026'
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
where jobname = 'shk-monthly-database-backup';
