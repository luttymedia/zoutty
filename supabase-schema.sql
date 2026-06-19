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
