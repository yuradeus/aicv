-- Supabase SQL (run in SQL Editor)
-- Minimal "resume platform" schema: one resume per user, private by default.

create extension if not exists pgcrypto;

create table if not exists public.resumes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  title text not null default '',
  city text not null default '',
  age int,
  photo_url text not null default '',
  markdown text not null default '',
  about text not null default '',
  experience text not null default '',
  education text not null default '',
  skills text not null default '',
  contacts text not null default '',
  slug text unique,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

-- allow re-running schema.sql later
alter table public.resumes add column if not exists city text not null default '';
alter table public.resumes add column if not exists age int;
alter table public.resumes add column if not exists about text not null default '';
alter table public.resumes add column if not exists experience text not null default '';
alter table public.resumes add column if not exists education text not null default '';
alter table public.resumes add column if not exists skills text not null default '';
alter table public.resumes add column if not exists contacts text not null default '';

create index if not exists resumes_slug_idx on public.resumes (slug);

alter table public.resumes enable row level security;

-- Owner access
drop policy if exists "Resumes owner read" on public.resumes;
create policy "Resumes owner read"
on public.resumes for select
using (auth.uid() = user_id);

drop policy if exists "Resumes owner insert" on public.resumes;
create policy "Resumes owner insert"
on public.resumes for insert
with check (auth.uid() = user_id);

drop policy if exists "Resumes owner update" on public.resumes;
create policy "Resumes owner update"
on public.resumes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Public read (only published)
drop policy if exists "Resumes public read published" on public.resumes;
create policy "Resumes public read published"
on public.resumes for select
using (is_published = true and slug is not null and slug <> '');

