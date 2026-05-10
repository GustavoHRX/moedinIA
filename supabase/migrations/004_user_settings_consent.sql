-- Persist Terms of Use and Privacy Policy consent metadata.
-- Run this after the existing user_settings table is available.

alter table public.user_settings
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_version text;

create index if not exists idx_user_settings_terms_privacy_versions
on public.user_settings(user_id, terms_version, privacy_version);
