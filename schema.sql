-- ETERNO Server — schema do Supabase
-- Rode no SQL Editor do novo projeto Supabase.

create extension if not exists "pgcrypto";

-- =============================================================================
-- clients
-- =============================================================================
create table if not exists public.clients (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  phone                 text,
  email                 text,
  birth_date            date,
  birth_place           text,
  family_contact_name   text,
  family_contact_phone  text,
  created_at            timestamptz not null default now()
);

create index if not exists clients_name_idx on public.clients (name);

-- =============================================================================
-- sessions
-- =============================================================================
create table if not exists public.sessions (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  session_number    int  not null,
  status            text not null default 'pending'
                    check (status in ('pending','in_progress','completed','cancelled')),
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_minutes  int,
  vapi_call_id      text,
  created_at        timestamptz not null default now()
);

create index if not exists sessions_client_id_idx       on public.sessions (client_id);
create index if not exists sessions_client_number_idx   on public.sessions (client_id, session_number);

-- =============================================================================
-- transcripts
-- =============================================================================
create table if not exists public.transcripts (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references public.sessions(id) on delete cascade,
  speaker       text not null check (speaker in ('agent','client')),
  content       text not null,
  timestamp_ms  bigint not null,
  created_at    timestamptz not null default now()
);

create index if not exists transcripts_session_idx on public.transcripts (session_id, timestamp_ms);

-- =============================================================================
-- extractions
-- =============================================================================
create table if not exists public.extractions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id)  on delete cascade,
  session_id  uuid references public.sessions(id) on delete set null,
  category    text not null,
  content     text not null,
  importance  int  not null check (importance between 1 and 10),
  created_at  timestamptz not null default now()
);

create index if not exists extractions_client_idx     on public.extractions (client_id, created_at desc);
create index if not exists extractions_importance_idx on public.extractions (client_id, importance desc);

-- =============================================================================
-- RLS — o servidor usa SERVICE_ROLE, que bypassa RLS.
-- Mantemos RLS ligado mas sem policies pra bloquear acesso público via anon key.
-- =============================================================================
alter table public.clients     enable row level security;
alter table public.sessions    enable row level security;
alter table public.transcripts enable row level security;
alter table public.extractions enable row level security;
