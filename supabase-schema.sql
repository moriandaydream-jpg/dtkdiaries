create extension if not exists pgcrypto;

create table if not exists public.fandom_diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  track_title text,
  artist_name text,
  album_title text,
  release_date text,
  musicbrainz_recording_id uuid,
  musicbrainz_release_id uuid,
  entry_date date not null default current_date,
  category text not null default 'daily',
  bias text,
  era text not null default 'Supernova',
  mood text,
  rating smallint check (rating is null or rating between 1 and 5),
  body text,
  tags text[] not null default '{}',
  media_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fandom_diary_entries
  add column if not exists track_title text,
  add column if not exists artist_name text,
  add column if not exists album_title text,
  add column if not exists release_date text,
  add column if not exists musicbrainz_recording_id uuid,
  add column if not exists musicbrainz_release_id uuid;

create index if not exists fandom_diary_entries_user_date_idx
  on public.fandom_diary_entries (user_id, entry_date desc, created_at desc);

alter table public.fandom_diary_entries enable row level security;

drop policy if exists "Users can read own diary entries" on public.fandom_diary_entries;
create policy "Users can read own diary entries"
  on public.fandom_diary_entries
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own diary entries" on public.fandom_diary_entries;
create policy "Users can insert own diary entries"
  on public.fandom_diary_entries
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own diary entries" on public.fandom_diary_entries;
create policy "Users can update own diary entries"
  on public.fandom_diary_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own diary entries" on public.fandom_diary_entries;
create policy "Users can delete own diary entries"
  on public.fandom_diary_entries
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_fandom_diary_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_fandom_diary_entries_updated_at on public.fandom_diary_entries;
create trigger set_fandom_diary_entries_updated_at
  before update on public.fandom_diary_entries
  for each row
  execute function public.set_fandom_diary_updated_at();
