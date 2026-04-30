-- Voice Favorites: stores liked voices per provider
-- Allows the system to auto-pick preferred voices during generation

create table if not exists studio_voice_favorites (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  provider text not null check (provider in ('fish_audio', 'elevenlabs')),
  voice_id text not null,
  name text not null,
  preview_url text,
  language text,
  gender text,
  accent text,
  tags text[],
  unique(provider, voice_id)
);

create index if not exists idx_studio_voice_favorites_provider
  on studio_voice_favorites(provider);
create index if not exists idx_studio_voice_favorites_language
  on studio_voice_favorites(provider, language);

alter table studio_voice_favorites enable row level security;
