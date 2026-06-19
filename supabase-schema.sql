-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Drop existing tables to recreate with correct camelCase column names
drop table if exists sessionMedia cascade;
drop table if exists glossaries cascade;
drop table if exists sessionGroups cascade;
drop table if exists finalReports cascade;
drop table if exists audios cascade;
drop table if exists sessions cascade;

-- SESSIONS
create table sessions (
  "id" text primary key,
  "user_id" uuid references auth.users not null,
  "title" text not null,
  "subtitle" text,
  "date" bigint not null,
  "summary" text,
  "notes" text,
  "cardOrder" text[],
  "groupId" text,
  "glossaryId" text,
  "customGlossaryStyle" text,
  "shareId" text,
  "shareTimestamp" bigint,
  "shareMethod" text,
  "sharedContent" jsonb,
  "isDemo" boolean default false,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "deleted" boolean default false not null,
  "equipment" text,
  "cameraSettings" text,
  "generalNotes" text,
  "location" text
);

-- AUDIOS
create table audios (
  "id" text primary key,
  "user_id" uuid references auth.users not null,
  "sessionId" text not null,
  "timestamp" bigint not null,
  "language" text not null,
  "transcript" text,
  "bulletPoints" text[],
  "strictSummary" text[],
  "expandedInsights" jsonb,
  "type" text not null,
  "filename" text,
  "audio_storage_path" text,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "deleted" boolean default false not null
);

-- FINAL REPORTS
create table finalReports (
  "id" text primary key,
  "user_id" uuid references auth.users not null,
  "sessionId" text not null,
  "report" jsonb not null,
  "timestamp" bigint not null,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "deleted" boolean default false not null
);

-- GROUPS
create table sessionGroups (
  "id" text primary key,
  "user_id" uuid references auth.users not null,
  "name" text not null,
  "dateCreated" bigint not null,
  "sessionOrder" text[],
  "folderOrder" text[],
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "deleted" boolean default false not null
);

-- GLOSSARIES
create table glossaries (
  "id" text primary key,
  "user_id" uuid references auth.users not null,
  "name" text not null,
  "terms" jsonb not null,
  "isSystem" boolean default false,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "deleted" boolean default false not null
);

-- SESSION MEDIA
create table sessionMedia (
  "id" text primary key,
  "user_id" uuid references auth.users not null,
  "sessionId" text not null,
  "timestamp" bigint not null,
  "filename" text not null,
  "mimeType" text not null,
  "size" bigint not null,
  "storageMode" text not null,
  "media_storage_path" text,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "deleted" boolean default false not null
);

-- Set up Row Level Security (RLS)
alter table sessions enable row level security;
alter table audios enable row level security;
alter table finalReports enable row level security;
alter table sessionGroups enable row level security;
alter table glossaries enable row level security;
alter table sessionMedia enable row level security;

-- Create RLS Policies
create policy "Users can only see their own sessions" on sessions for all using (auth.uid() = user_id);
create policy "Users can only see their own audios" on audios for all using (auth.uid() = user_id);
create policy "Users can only see their own finalReports" on finalReports for all using (auth.uid() = user_id);
create policy "Users can only see their own groups" on sessionGroups for all using (auth.uid() = user_id);
create policy "Users can only see their own glossaries" on glossaries for all using (auth.uid() = user_id);
create policy "Users can only see their own media" on sessionMedia for all using (auth.uid() = user_id);

-- Create the missing storage buckets
insert into storage.buckets (id, name, public) values ('audios', 'audios', true);
insert into storage.buckets (id, name, public) values ('sessionMedia', 'sessionMedia', true);

-- Set up basic access policies for the buckets
create policy "Anyone can view audios" on storage.objects for select using ( bucket_id = 'audios' );
create policy "Authenticated users can upload audios" on storage.objects for insert with check ( auth.role() = 'authenticated' and bucket_id = 'audios' );
create policy "Users can update their own audios" on storage.objects for update using ( auth.uid() = owner and bucket_id = 'audios' );
create policy "Users can delete their own audios" on storage.objects for delete using ( auth.uid() = owner and bucket_id = 'audios' );

create policy "Anyone can view sessionMedia" on storage.objects for select using ( bucket_id = 'sessionMedia' );
create policy "Authenticated users can upload sessionMedia" on storage.objects for insert with check ( auth.role() = 'authenticated' and bucket_id = 'sessionMedia' );
create policy "Users can update their own sessionMedia" on storage.objects for update using ( auth.uid() = owner and bucket_id = 'sessionMedia' );
create policy "Users can delete their own sessionMedia" on storage.objects for delete using ( auth.uid() = owner and bucket_id = 'sessionMedia' );

-- Function to securely fetch a shared session using a 6-digit code
create or replace function public.fetch_shared_session(p_share_id text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_session record;
  v_report record;
  v_audios jsonb;
  v_media jsonb;
  v_result jsonb;
begin
  -- Find session
  select * into v_session from sessions where "shareId" = p_share_id and "deleted" = false limit 1;
  
  if v_session is null then
    return null;
  end if;

  v_result := jsonb_build_object(
    'title', v_session.title,
    'subtitle', v_session.subtitle,
    'date', v_session.date
  );

  if (v_session."sharedContent"->>'notes')::boolean then
    v_result := jsonb_set(v_result, '{notes}', to_jsonb(v_session.notes));
  end if;

  if (v_session."sharedContent"->>'report')::boolean then
    select * into v_report from "finalReports" where "sessionId" = v_session.id and "deleted" = false limit 1;
    if v_report is not null then
      v_result := jsonb_set(v_result, '{report}', v_report.report);
      v_result := jsonb_set(v_result, '{reportTimestamp}', to_jsonb(v_report.timestamp));
    end if;
  end if;

  IF (v_session."sharedContent"->>'transcripts')::boolean OR (v_session."sharedContent"->>'media')::boolean THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'filename', filename,
        'timestamp', timestamp,
        'transcript', (CASE WHEN (v_session."sharedContent"->>'transcripts')::boolean THEN transcript ELSE NULL END),
        'strictSummary', (CASE WHEN (v_session."sharedContent"->>'transcripts')::boolean THEN "strictSummary" ELSE NULL END),
        'expandedInsights', (CASE WHEN (v_session."sharedContent"->>'transcripts')::boolean THEN "expandedInsights" ELSE NULL END),
        'audio_storage_path', (CASE WHEN (v_session."sharedContent"->>'media')::boolean THEN audio_storage_path ELSE NULL END)
      )
    ) INTO v_audios
    FROM audios WHERE "sessionId" = v_session.id AND "deleted" = false;
    
    IF v_audios IS NOT NULL THEN
      v_result := jsonb_set(v_result, '{transcripts}', v_audios);
    END IF;
  END IF;

  IF (v_session."sharedContent"->>'media')::boolean THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'filename', filename,
        'mimeType', "mimeType",
        'timestamp', timestamp,
        'media_storage_path', media_storage_path
      )
    ) INTO v_media
    FROM sessionmedia WHERE "sessionId" = v_session.id AND "deleted" = false;

    IF v_media IS NOT NULL THEN
      v_result := jsonb_set(v_result, '{mediaItems}', v_media);
    END IF;
  END IF;

  RETURN v_result;
END;
$$;
