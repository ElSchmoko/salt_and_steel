-- Salt & Steel multiplayer: match state and seat tokens.
-- Row level security is on with no policies, so only the server function (service role) can read or write.
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  state       jsonb not null,
  version     integer not null default 1,
  status      text not null default 'waiting' check (status in ('waiting', 'playing', 'over')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.match_seats (
  match_id   uuid not null references public.matches(id) on delete cascade,
  seat       integer not null,
  token_hash text not null,
  primary key (match_id, seat)
);

alter table public.matches enable row level security;
alter table public.match_seats enable row level security;
