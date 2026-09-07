# Supabase pg_cron TTL Management Guide

This document contains instructions and reference SQL queries for managing the automated 30-day soft-delete TTL purge in Supabase for **Zoutty**.

---

## 1. Overview

* **Purpose:** Permanently delete database records that have been soft-deleted (`deleted = true`) for longer than 30 days.
* **Mechanism:** PostgreSQL native extension `pg_cron` invoking a stored function `public.purge_soft_deleted_records()`.
* **Schedule:** Daily at 03:00 UTC (`0 3 * * *`).
* **Tables Cleaned:**
  1. `sessionmedia`
  2. `finalreports`
  3. `audios`
  4. `sessiongroups`
  5. `sessions`
  *(Child records are deleted first to preserve relational integrity).*

---

## 2. Cleanup Function Definition

If you ever need to recreate or inspect the cleanup function, run this in the Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION public.purge_soft_deleted_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Purge child records first (soft-deleted 30+ days ago)
  DELETE FROM sessionmedia WHERE deleted = true AND updated_at < now() - interval '30 days';
  DELETE FROM finalreports WHERE deleted = true AND updated_at < now() - interval '30 days';
  DELETE FROM audios       WHERE deleted = true AND updated_at < now() - interval '30 days';
  DELETE FROM sessiongroups WHERE deleted = true AND updated_at < now() - interval '30 days';
  
  -- 2. Purge parent sessions
  DELETE FROM sessions     WHERE deleted = true AND updated_at < now() - interval '30 days';
END;
$$;
```

---

## 3. Scheduling Command

To register or re-register the daily cron job:

```sql
SELECT cron.schedule(
  'purge-soft-deleted-records',
  '0 3 * * *',
  'SELECT public.purge_soft_deleted_records();'
);
```

---

## 4. Useful Management Commands

### A. View All Scheduled Cron Jobs
Inspect all registered jobs, their schedules, active status, and command:
```sql
SELECT 
  jobid, 
  jobname, 
  schedule, 
  command, 
  active 
FROM cron.job;
```

---

### B. Check Execution History & Logs
View the last 20 runs, whether they succeeded (`status`), start/end times, and error messages (if any):
```sql
SELECT 
  runid, 
  jobid, 
  status, 
  return_message, 
  start_time, 
  end_time 
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

---

### C. Manually Trigger the Cleanup Function
Run the cleanup immediately at any time without waiting for the scheduled 3:00 AM UTC run:
```sql
SELECT public.purge_soft_deleted_records();
```

---

### D. Preview Records Eligible for Purge (Dry Run)
Check how many rows are currently queued for deletion without actually deleting them:
```sql
SELECT 'sessionmedia' AS table_name, count(*) FROM sessionmedia WHERE deleted = true AND updated_at < now() - interval '30 days'
UNION ALL
SELECT 'finalreports', count(*) FROM finalreports WHERE deleted = true AND updated_at < now() - interval '30 days'
UNION ALL
SELECT 'audios', count(*) FROM audios WHERE deleted = true AND updated_at < now() - interval '30 days'
UNION ALL
SELECT 'sessiongroups', count(*) FROM sessiongroups WHERE deleted = true AND updated_at < now() - interval '30 days'
UNION ALL
SELECT 'sessions', count(*) FROM sessions WHERE deleted = true AND updated_at < now() - interval '30 days';
```

---

### E. Pause or Unschedule the Job
If you want to stop the automated cron job from running:
```sql
-- Unschedule completely by job name:
SELECT cron.unschedule('purge-soft-deleted-records');

-- Or deactivate without deleting the job row:
UPDATE cron.job SET active = false WHERE jobname = 'purge-soft-deleted-records';

-- To reactivate later:
UPDATE cron.job SET active = true WHERE jobname = 'purge-soft-deleted-records';
```

---

### F. Change the Schedule or Retention Window
* **To change the time of day:** Unschedule the existing job and call `cron.schedule` with your preferred cron expression (e.g. `'0 4 * * *'` for 4:00 AM UTC).
* **To change the retention window (e.g. 60 days instead of 30):** Update the `interval '30 days'` to `interval '60 days'` in the function definition (Section 2) and re-run `CREATE OR REPLACE FUNCTION ...`.
