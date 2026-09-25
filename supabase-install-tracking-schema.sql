-- ==============================================================================
-- Zoutty PWA Device & Installation Tracking Schema (Supabase)
-- ==============================================================================

create table if not exists public.install_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  device_platform text not null, -- 'iOS', 'Android', 'Windows', 'macOS', 'Linux', 'ChromeOS', 'Other'
  device_type text not null,     -- 'mobile', 'tablet', 'desktop'
  browser text not null,         -- 'Safari', 'Chrome', 'Edge', 'Firefox', 'Samsung Internet', 'Opera', etc.
  browser_version text,
  os_version text,
  user_agent text not null,
  screen_resolution text,        -- e.g. '390x844'
  screen_density numeric,        -- window.devicePixelRatio (e.g. 2, 3)
  install_source text not null,  -- 'pwa_prompt', 'standalone_launch', 'ios_guide', 'related_apps'
  language text,                 -- e.g. 'en-US', 'es'
  timezone text,                 -- e.g. 'Europe/Madrid'
  ip_address text,
  installed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  raw_details jsonb default '{}'::jsonb
);

-- Create indexes for performance and fast aggregate reporting
create index if not exists idx_install_tracking_platform on public.install_tracking(device_platform);
create index if not exists idx_install_tracking_device_type on public.install_tracking(device_type);
create index if not exists idx_install_tracking_installed_at on public.install_tracking(installed_at);
create index if not exists idx_install_tracking_user_id on public.install_tracking(user_id);

-- Enable Row Level Security (RLS)
alter table public.install_tracking enable row level security;

-- Drop any prior policies if re-running
drop policy if exists "Allow inserts from authenticated and anon" on public.install_tracking;
drop policy if exists "Allow service role full access" on public.install_tracking;

-- Allow insert from anon/authenticated clients
create policy "Allow inserts from authenticated and anon"
  on public.install_tracking for insert
  with check (true);

-- Allow service role full access for analytics queries and server maintenance
create policy "Allow service role full access"
  on public.install_tracking for all
  using (auth.jwt() ->> 'role' = 'service_role');
