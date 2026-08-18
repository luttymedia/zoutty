-- ==============================================================================
-- Zoutty Monetization & Tier Architecture Schema (Supabase)
-- ==============================================================================

-- 1. Enable UUID Extension if not already enabled
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. PROFILES (User Tier, Billing & Referral State)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  tier text check (tier in ('free', 'student', 'teacher')) default 'free' not null,
  subscription_status text check (subscription_status in ('none', 'active', 'trialing', 'past_due', 'canceled', 'unpaid')) default 'none' not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean default false not null,
  referral_code text unique not null,
  referred_by uuid references auth.users(id) on delete set null,
  referral_boost_expires_at timestamp with time zone,
  referral_boost_extra_sessions integer default 0 not null,
  referral_boost_extra_clips integer default 0 not null,
  referral_credits_balance integer default 0 not null, -- count of €1 discount units remaining
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. USAGE TRACKING (Lifetime & Period Quotas)
create table if not exists public.usage_tracking (
  user_id uuid references auth.users(id) on delete cascade primary key,
  lifetime_sessions integer default 0 not null,
  lifetime_clips integer default 0 not null,
  period_sessions integer default 0 not null,
  period_start timestamp with time zone default timezone('utc'::text, now()) not null,
  period_end timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. REFERRAL LOGS (Audit & Reward Tracking)
create table if not exists public.referral_logs (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references auth.users(id) on delete set null,
  referred_user_id uuid references auth.users(id) on delete cascade not null,
  reward_type text check (reward_type in ('free_boost', 'student_credit', 'teacher_credit')) not null,
  reward_value numeric default 0 not null,
  status text check (status in ('pending', 'active', 'revoked')) default 'pending' not null,
  stripe_invoice_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  activated_at timestamp with time zone,
  revoked_at timestamp with time zone
);

-- Create indexes for performance
create index if not exists idx_profiles_referral_code on public.profiles(referral_code);
create index if not exists idx_profiles_stripe_cust on public.profiles(stripe_customer_id);
create index if not exists idx_profiles_stripe_sub on public.profiles(stripe_subscription_id);
create index if not exists idx_referral_logs_referrer on public.referral_logs(referrer_id);
create index if not exists idx_referral_logs_referred on public.referral_logs(referred_user_id);

-- 5. FUNCTION: Generate a clean, unique referral code
create or replace function public.generate_unique_referral_code()
returns text
language plpgsql
as $$
declare
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- Excludes easily confused chars (0, 1, I, O)
  v_code text := '';
  v_i integer;
  v_exists boolean;
begin
  loop
    v_code := '';
    for v_i in 1..7 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    end loop;
    
    select exists(select 1 from public.profiles where referral_code = v_code) into v_exists;
    if not v_exists then
      return v_code;
    end if;
  end loop;
end;
$$;

-- 6. FUNCTION & TRIGGER: Auto-create profile & usage_tracking on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_ref_code text;
  v_referred_by_id uuid := null;
  v_input_ref_code text;
begin
  -- Generate unique referral code
  v_ref_code := public.generate_unique_referral_code();

  -- Check if user signed up with a referral code in user_metadata
  v_input_ref_code := upper(trim(coalesce(new.raw_user_meta_data->>'referred_by_code', '')));
  if v_input_ref_code <> '' then
    select id into v_referred_by_id from public.profiles where upper(referral_code) = v_input_ref_code limit 1;
  end if;

  -- Insert profile
  insert into public.profiles (
    id,
    tier,
    subscription_status,
    referral_code,
    referred_by
  ) values (
    new.id,
    'free',
    'none',
    v_ref_code,
    v_referred_by_id
  ) on conflict (id) do nothing;

  -- Insert initial usage tracking
  insert into public.usage_tracking (
    user_id,
    lifetime_sessions,
    lifetime_clips,
    period_sessions,
    period_start
  ) values (
    new.id,
    0,
    0,
    0,
    timezone('utc'::text, now())
  ) on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. FUNCTION & TRIGGER: Updated_at auto-updater
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_usage_tracking_updated_at on public.usage_tracking;
create trigger set_usage_tracking_updated_at
  before update on public.usage_tracking
  for each row execute function public.set_updated_at();

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
alter table public.profiles enable row level security;
alter table public.usage_tracking enable row level security;
alter table public.referral_logs enable row level security;

-- Profiles Policies
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their non-billing profile fields" on public.profiles;
-- Note: Billing fields (tier, subscription_status, credits, boosts) are managed via server-side service role
create policy "Users can update their non-billing profile fields"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Usage Tracking Policies
drop policy if exists "Users can view their own usage tracking" on public.usage_tracking;
create policy "Users can view their own usage tracking"
  on public.usage_tracking for select
  using (auth.uid() = user_id);

-- Referral Logs Policies
drop policy if exists "Users can view their own referral logs" on public.referral_logs;
create policy "Users can view their own referral logs"
  on public.referral_logs for select
  using (auth.uid() = referrer_id or auth.uid() = referred_user_id);

-- 10. HELPER FUNCTIONS: Increment Usage Counters (RPC)
create or replace function public.increment_usage_clip(target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.usage_tracking
  set lifetime_clips = lifetime_clips + 1,
      updated_at = timezone('utc'::text, now())
  where user_id = target_user_id;
end;
$$;

create or replace function public.increment_usage_session(target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.usage_tracking
  set lifetime_sessions = lifetime_sessions + 1,
      period_sessions = period_sessions + 1,
      updated_at = timezone('utc'::text, now())
  where user_id = target_user_id;
end;
$$;

