-- Agent Arena v1 schema + RLS

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Handle-only profiles (v1: no accounts beyond handle + optional email later).
-- Not FK'd to auth.users so no-signup prompt paste works.
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  email text,
  created_at timestamptz not null default now(),
  constraint handle_format check (handle ~ '^[a-z0-9_]{2,24}$')
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  elo integer not null default 1200,
  wins integer not null default 0,
  losses integer not null default 0,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  constraint name_len check (char_length(name) between 2 and 48)
);

-- Prompt stored separately so RLS can hide it until match end / owner
create table public.agent_prompts (
  agent_id uuid primary key references public.agents (id) on delete cascade,
  system_prompt text not null
);

create table public.fixtures (
  id text primary key,
  name text not null,
  repo_tarball_url text not null,
  difficulty text not null default 'medium',
  hidden_suite_ref text not null,
  created_at timestamptz not null default now()
);

create type public.match_status as enum (
  'queued',
  'running',
  'finished',
  'cancelled',
  'budget_blocked'
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  fixture_id text not null references public.fixtures (id),
  agent_a uuid not null references public.agents (id),
  agent_b uuid not null references public.agents (id),
  status public.match_status not null default 'queued',
  winner_id uuid references public.agents (id),
  verdict text,
  started_at timestamptz,
  ended_at timestamptz,
  tokens_a integer not null default 0,
  tokens_b integer not null default 0,
  cost_cents integer not null default 0,
  created_at timestamptz not null default now(),
  constraint distinct_agents check (agent_a <> agent_b)
);

create type public.event_type as enum (
  'thought',
  'tool_call',
  'tool_result',
  'test_run',
  'verdict',
  'tamper'
);

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  agent_id uuid references public.agents (id),
  seq integer not null,
  ts timestamptz not null default now(),
  type public.event_type not null,
  payload jsonb not null default '{}'::jsonb,
  unique (match_id, seq)
);

create index match_events_match_seq on public.match_events (match_id, seq);

-- Global spend / kill switch (UTC day)
create table public.daily_spend (
  day date primary key,
  spend_cents integer not null default 0,
  match_count integer not null default 0,
  kill_switch boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value) values
  ('daily_budget_cents', '5000'::jsonb),
  ('model', '"gpt-4.1"'::jsonb),
  ('token_ceiling_per_agent', '80000'::jsonb);

-- Seed the one v1 fixture
insert into public.fixtures (id, name, repo_tarball_url, difficulty, hidden_suite_ref)
values (
  'async-race',
  'async-race',
  'file://fixtures/async-race',
  'medium',
  'fixtures/async-race/hidden'
);

-- ---------------------------------------------------------------------------
-- Prompt privacy: private to owner until match ends, then public
-- ---------------------------------------------------------------------------

create or replace function public.agent_prompt_revealed(p_agent_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.agents a
    where a.id = p_agent_id
      and (
        a.is_public
        or exists (
          select 1 from public.matches m
          where m.status = 'finished'
            and (m.agent_a = a.id or m.agent_b = a.id)
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Elo helper (K=32)
-- ---------------------------------------------------------------------------

create or replace function public.apply_elo(
  p_winner uuid,
  p_loser uuid
) returns void
language plpgsql
security definer
as $$
declare
  w integer;
  l integer;
  exp_w numeric;
  exp_l numeric;
  k integer := 32;
begin
  select elo into w from public.agents where id = p_winner for update;
  select elo into l from public.agents where id = p_loser for update;
  exp_w := 1.0 / (1.0 + power(10.0, (l - w) / 400.0));
  exp_l := 1.0 / (1.0 + power(10.0, (w - l) / 400.0));
  update public.agents
    set elo = round(w + k * (1 - exp_w))::integer,
        wins = wins + 1
    where id = p_winner;
  update public.agents
    set elo = round(l + k * (0 - exp_l))::integer,
        losses = losses + 1
    where id = p_loser;
end;
$$;

-- ---------------------------------------------------------------------------
-- Budget kill switch — must exist before any match runs
-- ---------------------------------------------------------------------------

create or replace function public.budget_allows_match()
returns boolean
language plpgsql
security definer
as $$
declare
  today date := (timezone('utc', now()))::date;
  budget integer;
  row public.daily_spend%rowtype;
begin
  select (value::text)::integer into budget
    from public.app_config where key = 'daily_budget_cents';
  if budget is null then
    budget := 5000;
  end if;

  insert into public.daily_spend (day) values (today)
    on conflict (day) do nothing;

  select * into row from public.daily_spend where day = today for update;

  if row.kill_switch or row.spend_cents >= budget then
    update public.daily_spend
      set kill_switch = true, updated_at = now()
      where day = today;
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.record_match_spend(p_cost_cents integer)
returns void
language plpgsql
security definer
as $$
declare
  today date := (timezone('utc', now()))::date;
  budget integer;
begin
  select (value::text)::integer into budget
    from public.app_config where key = 'daily_budget_cents';
  if budget is null then budget := 5000; end if;

  insert into public.daily_spend (day, spend_cents, match_count)
    values (today, p_cost_cents, 1)
    on conflict (day) do update
      set spend_cents = public.daily_spend.spend_cents + excluded.spend_cents,
          match_count = public.daily_spend.match_count + 1,
          updated_at = now(),
          kill_switch = (public.daily_spend.spend_cents + excluded.spend_cents) >= budget;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.agent_prompts enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.fixtures enable row level security;
alter table public.daily_spend enable row level security;
alter table public.app_config enable row level security;

-- Profiles: public read; inserts via service role for no-signup submit
create policy profiles_select on public.profiles for select using (true);

-- Agents metadata: public
create policy agents_select on public.agents for select using (true);

-- Prompts: owner or revealed after finished match. Service role bypasses RLS.
create policy agent_prompts_select on public.agent_prompts for select
  using (
    public.agent_prompt_revealed(agent_id)
    or exists (
      select 1 from public.agents a
      where a.id = agent_id and a.owner_id = auth.uid()
    )
  );

-- Convenience view
create or replace view public.agents_public as
select
  a.id,
  a.owner_id,
  a.name,
  case
    when public.agent_prompt_revealed(a.id) then p.system_prompt
    else null
  end as system_prompt,
  a.elo,
  a.wins,
  a.losses,
  a.is_public,
  a.created_at,
  public.agent_prompt_revealed(a.id) as prompt_revealed
from public.agents a
left join public.agent_prompts p on p.agent_id = a.id;

-- Matches + events: public read (the product is the replay)
create policy matches_select on public.matches for select using (true);
create policy match_events_select on public.match_events for select using (true);
create policy fixtures_select on public.fixtures for select using (true);

-- Spend/config: public read of kill-switch state only
create policy daily_spend_select on public.daily_spend for select using (true);
create policy app_config_select on public.app_config for select using (true);

-- Writes to matches/events/spend: service role only (no policies for authenticated)

-- Realtime
alter publication supabase_realtime add table public.match_events;
alter publication supabase_realtime add table public.matches;

-- Landing counter: test files deleted to fake a pass
create or replace function public.tamper_count()
returns bigint
language sql
stable
as $$
  select count(*) from public.match_events where type = 'tamper';
$$;
