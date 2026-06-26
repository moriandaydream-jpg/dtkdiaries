alter table public.fandom_diary_entries
  add column if not exists track_title text,
  add column if not exists artist_name text,
  add column if not exists album_title text,
  add column if not exists release_date text,
  add column if not exists musicbrainz_recording_id uuid,
  add column if not exists musicbrainz_release_id uuid;
