-- Asset Favorites: liked music, SFX, color palettes, animation presets
-- System uses these as defaults when generating new videos

create table if not exists studio_asset_favorites (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  asset_type text not null check (asset_type in (
    'music_track', 'sfx', 'color_palette', 'animation_preset', 'visual_style'
  )),
  provider text not null default 'epidemic_sound',
  external_id text,
  name text not null,
  metadata jsonb default '{}',
  preview_url text,
  usage_count integer default 0,
  last_used_at timestamptz default now(),
  unique(asset_type, provider, external_id)
);

create index if not exists idx_asset_favorites_type
  on studio_asset_favorites(asset_type);
create index if not exists idx_asset_favorites_usage
  on studio_asset_favorites(usage_count desc);

alter table studio_asset_favorites enable row level security;
