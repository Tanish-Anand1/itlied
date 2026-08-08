-- ItLied platform expansion: auth profiles, social, match fields, tournaments, clips, seasons
-- Local/dev: clears pre-auth orphan rows so profiles.id can FK auth.users.

-- ---------------------------------------------------------------------------
-- Clear pre-auth data (handle-only profiles are incompatible with auth.users FK)
-- ---------------------------------------------------------------------------

truncate table public.match_events restart identity cascade;
truncate table public.matches restart identity cascade;
truncate table public.agent_prompts restart identity cascade;
truncate table public.agents restart identity cascade;
truncate table public.profiles restart identity cascade;

-- ---------------------------------------------------------------------------
-- Profiles → auth.users
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists github_id text,
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists role text not null default 'user';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'ops'));

-- id must equal auth.users.id
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  final_handle text;
  n int := 0;
begin
  base_handle := lower(regexp_replace(
    coalesce(
      new.raw_user_meta_data->>'handle',
      split_part(coalesce(new.email, 'user'), '@', 1),
      'user'
    ),
    '[^a-z0-9_]',
    '',
    'g'
  ));
  if char_length(base_handle) < 2 then
    base_handle := 'user';
  end if;
  base_handle := left(base_handle, 20);
  final_handle := base_handle;
  while exists (select 1 from public.profiles where handle = final_handle) loop
    n := n + 1;
    final_handle := left(base_handle, 20 - char_length(n::text) - 1) || '_' || n::text;
  end loop;

  insert into public.profiles (id, handle, email, display_name)
  values (
    new.id,
    final_handle,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', final_handle)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles RLS: public read; own update
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Match expansion columns
-- ---------------------------------------------------------------------------

create type public.match_format as enum ('race_symmetric', 'race_asymmetric');

alter table public.matches
  add column if not exists model_id text not null default 'openai/gpt-4.1-mini',
  add column if not exists format public.match_format not null default 'race_symmetric',
  add column if not exists objective_a text,
  add column if not exists objective_b text,
  add column if not exists season_id uuid;

-- Second fixture seed
insert into public.fixtures (id, name, repo_tarball_url, difficulty, hidden_suite_ref)
values (
  'json-merge',
  'json-merge',
  'file://fixtures/json-merge',
  'medium',
  'fixtures/json-merge/hidden'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create type public.friendship_status as enum ('pending', 'accepted', 'blocked');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_pair unique (requester_id, addressee_id)
);

create table public.match_comments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comment_len check (char_length(body) between 1 and 2000)
);

create index match_comments_match on public.match_comments (match_id, created_at);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (conversation_id, profile_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint message_len check (char_length(body) between 1 and 4000)
);

create index messages_conversation on public.messages (conversation_id, created_at);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.follows enable row level security;
alter table public.friendships enable row level security;
alter table public.match_comments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

create policy follows_select on public.follows for select using (true);
create policy follows_insert on public.follows for insert with check (auth.uid() = follower_id);
create policy follows_delete on public.follows for delete using (auth.uid() = follower_id);

create policy friendships_select on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy friendships_insert on public.friendships for insert
  with check (auth.uid() = requester_id);
create policy friendships_update on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy comments_select on public.match_comments for select using (true);
create policy comments_insert on public.match_comments for insert
  with check (auth.uid() = author_id);
create policy comments_delete on public.match_comments for delete
  using (auth.uid() = author_id);

create policy conversation_members_select on public.conversation_members for select
  using (auth.uid() = profile_id or exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conversation_members.conversation_id
      and m.profile_id = auth.uid()
  ));

create policy conversations_select on public.conversations for select
  using (exists (
    select 1 from public.conversation_members m
    where m.conversation_id = id and m.profile_id = auth.uid()
  ));

create policy messages_select on public.messages for select
  using (exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id and m.profile_id = auth.uid()
  ));
create policy messages_insert on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = conversation_id and m.profile_id = auth.uid()
    )
  );

create policy reports_insert on public.reports for insert with check (auth.uid() = reporter_id);

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.match_comments;

-- ---------------------------------------------------------------------------
-- Seasons + tournaments
-- ---------------------------------------------------------------------------

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  elo_epoch integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.seasons (name, elo_epoch, active)
values ('Season 1', 1, true);

alter table public.matches
  drop constraint if exists matches_season_id_fkey;
alter table public.matches
  add constraint matches_season_id_fkey
  foreign key (season_id) references public.seasons (id);

create type public.tournament_status as enum (
  'draft', 'open', 'seeding', 'active', 'completed', 'cancelled'
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  name text not null,
  status public.tournament_status not null default 'draft',
  fixture_id text not null references public.fixtures (id),
  model_id text not null default 'openai/gpt-4.1-mini',
  format public.match_format not null default 'race_symmetric',
  bracket_size integer not null default 8,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint bracket_pow2 check (bracket_size in (4, 8, 16, 32))
);

create table public.tournament_entrants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  agent_id uuid not null references public.agents (id),
  seed integer,
  eliminated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tournament_id, profile_id)
);

create table public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round integer not null,
  slot integer not null,
  entrant_a uuid references public.tournament_entrants (id),
  entrant_b uuid references public.tournament_entrants (id),
  match_id uuid references public.matches (id),
  winner_entrant_id uuid references public.tournament_entrants (id),
  unique (tournament_id, round, slot)
);

alter table public.seasons enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_entrants enable row level security;
alter table public.tournament_matches enable row level security;

create policy seasons_select on public.seasons for select using (true);
create policy tournaments_select on public.tournaments for select using (true);
create policy tournament_entrants_select on public.tournament_entrants for select using (true);
create policy tournament_matches_select on public.tournament_matches for select using (true);

create policy tournament_entrants_insert on public.tournament_entrants for insert
  with check (auth.uid() = profile_id);

-- ---------------------------------------------------------------------------
-- Clips
-- ---------------------------------------------------------------------------

create type public.clip_status as enum (
  'queued', 'rendering', 'ready', 'failed'
);

create table public.match_clips (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  start_seq integer not null,
  end_seq integer not null,
  status public.clip_status not null default 'queued',
  storage_path text,
  poster_path text,
  error text,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  constraint clip_range check (end_seq >= start_seq and start_seq >= 1)
);

alter table public.match_clips enable row level security;

create policy clips_select on public.match_clips for select using (true);
create policy clips_insert on public.match_clips for insert
  with check (auth.uid() = created_by);
create policy clips_update_own on public.match_clips for update
  using (auth.uid() = created_by);

-- Agents: owner can insert/update own
drop policy if exists agents_insert_own on public.agents;
create policy agents_insert_own on public.agents for insert
  with check (auth.uid() = owner_id);

drop policy if exists agent_prompts_insert_own on public.agent_prompts;
create policy agent_prompts_insert_own on public.agent_prompts for insert
  with check (exists (
    select 1 from public.agents a where a.id = agent_id and a.owner_id = auth.uid()
  ));
