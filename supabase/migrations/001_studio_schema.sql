-- Vocito Studio Schema — Brief A3
-- Run in Supabase Dashboard → SQL Editor → New Query

-- Required extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- studio_prompts
-- ============================================
create table if not exists studio_prompts (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  raw_prompt text not null,
  language text not null default 'en',
  scene_plan jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'plan_pending', 'plan_ready', 'plan_approved', 'plan_rejected')),
  review_feedback text,
  reviewed_at timestamptz,
  notes text
);

create index if not exists idx_studio_prompts_status on studio_prompts(status);
create index if not exists idx_studio_prompts_created_at on studio_prompts(created_at desc);

-- ============================================
-- studio_video_runs
-- ============================================
create table if not exists studio_video_runs (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  prompt_id uuid references studio_prompts(id) on delete cascade,
  scene_plan jsonb not null,
  language text not null default 'en',
  composition_id text,
  music_recording_id text,
  music_url text,
  voice_id text,
  vo_url text,
  sfx_assets jsonb,
  output_url text,
  thumbnail_url text,
  duration_seconds numeric(6,2),
  file_size_bytes bigint,
  status text not null default 'pending'
    check (status in (
      'pending', 'planning', 'downloading', 'generating_vo',
      'rendering', 'uploading', 'completed', 'failed', 'cancelled'
    )),
  progress_percent integer default 0 check (progress_percent between 0 and 100),
  current_step text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  render_duration_ms integer,
  reviewed_at timestamptz,
  review_decision text check (review_decision in ('approved', 'rejected')),
  review_feedback text,
  iteration_number integer not null default 1,
  parent_run_id uuid references studio_video_runs(id) on delete set null
);

create index if not exists idx_studio_video_runs_status on studio_video_runs(status);
create index if not exists idx_studio_video_runs_prompt_id on studio_video_runs(prompt_id);
create index if not exists idx_studio_video_runs_created_at on studio_video_runs(created_at desc);
create index if not exists idx_studio_video_runs_pending
  on studio_video_runs(status, created_at)
  where status = 'pending';

-- ============================================
-- studio_feedback
-- ============================================
create table if not exists studio_feedback (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  run_id uuid references studio_video_runs(id) on delete cascade,
  category text not null check (category in (
    'visual', 'audio_music', 'audio_vo', 'audio_sfx',
    'timing', 'copy', 'overall', 'other'
  )),
  sentiment text not null check (sentiment in ('positive', 'negative', 'neutral')),
  comment text,
  timestamp_seconds numeric(6,2),
  is_blocking boolean default false
);

create index if not exists idx_studio_feedback_run_id on studio_feedback(run_id);
create index if not exists idx_studio_feedback_category on studio_feedback(category);

-- ============================================
-- studio_learnings
-- ============================================
create table if not exists studio_learnings (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  category text not null,
  pattern text not null,
  recommendation text not null,
  supporting_feedback_count integer default 1,
  confidence_score numeric(3,2) default 0.5 check (confidence_score between 0 and 1),
  applies_to_scene_types text[],
  active boolean default true
);

create index if not exists idx_studio_learnings_active on studio_learnings(active) where active = true;

-- ============================================
-- studio_assets
-- ============================================
create table if not exists studio_assets (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  last_used_at timestamptz default now(),
  source text not null check (source in ('epidemic_sound', 'fish_audio', 'user_upload')),
  external_id text not null,
  asset_type text not null check (asset_type in ('music', 'sfx', 'voice', 'vo_generated')),
  title text,
  duration_ms integer,
  bpm integer,
  mood text,
  tags text[],
  supabase_storage_path text,
  public_url text,
  used_in_runs integer default 0,
  unique(source, external_id)
);

create index if not exists idx_studio_assets_source_type on studio_assets(source, asset_type);
create index if not exists idx_studio_assets_last_used on studio_assets(last_used_at desc);

-- ============================================
-- Auto-update updated_at trigger
-- ============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_studio_prompts_updated_at on studio_prompts;
create trigger update_studio_prompts_updated_at
  before update on studio_prompts
  for each row execute function update_updated_at_column();

drop trigger if exists update_studio_video_runs_updated_at on studio_video_runs;
create trigger update_studio_video_runs_updated_at
  before update on studio_video_runs
  for each row execute function update_updated_at_column();

drop trigger if exists update_studio_learnings_updated_at on studio_learnings;
create trigger update_studio_learnings_updated_at
  before update on studio_learnings
  for each row execute function update_updated_at_column();

-- ============================================
-- Row Level Security
-- ============================================
alter table studio_prompts enable row level security;
alter table studio_video_runs enable row level security;
alter table studio_feedback enable row level security;
alter table studio_learnings enable row level security;
alter table studio_assets enable row level security;
