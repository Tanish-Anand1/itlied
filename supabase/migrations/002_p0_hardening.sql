-- P0: atomic budget reserve, DB-serialized match event seq

alter table public.daily_spend
  add column if not exists reserved_cents integer not null default 0;

-- ---------------------------------------------------------------------------
-- Budget: reserve at match start, finalize (or release) at end
-- ---------------------------------------------------------------------------

create or replace function public.reserve_match_budget(p_reserve_cents integer)
returns jsonb
language plpgsql
security definer
as $$
declare
  today date := (timezone('utc', now()))::date;
  budget integer;
  row public.daily_spend%rowtype;
  committed integer;
begin
  if p_reserve_cents is null or p_reserve_cents < 0 then
    raise exception 'invalid reserve';
  end if;

  select (value::text)::integer into budget
    from public.app_config where key = 'daily_budget_cents';
  if budget is null then budget := 5000; end if;

  insert into public.daily_spend (day) values (today)
    on conflict (day) do nothing;

  select * into row from public.daily_spend where day = today for update;

  committed := row.spend_cents + row.reserved_cents;

  if row.kill_switch or committed + p_reserve_cents > budget then
    update public.daily_spend
      set kill_switch = true, updated_at = now()
      where day = today;
    return jsonb_build_object(
      'allowed', false,
      'day', today,
      'spend_cents', row.spend_cents,
      'reserved_cents', row.reserved_cents,
      'budget_cents', budget,
      'kill_switch', true
    );
  end if;

  update public.daily_spend
    set reserved_cents = reserved_cents + p_reserve_cents,
        updated_at = now()
    where day = today
    returning * into row;

  return jsonb_build_object(
    'allowed', true,
    'day', today,
    'spend_cents', row.spend_cents,
    'reserved_cents', row.reserved_cents,
    'budget_cents', budget,
    'kill_switch', row.kill_switch,
    'reserve_cents', p_reserve_cents
  );
end;
$$;

create or replace function public.finalize_match_spend(
  p_cost_cents integer,
  p_reserve_cents integer
)
returns void
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
  if budget is null then budget := 5000; end if;

  insert into public.daily_spend (day) values (today)
    on conflict (day) do nothing;

  select * into row from public.daily_spend where day = today for update;

  update public.daily_spend
    set spend_cents = spend_cents + greatest(coalesce(p_cost_cents, 0), 0),
        reserved_cents = greatest(reserved_cents - greatest(coalesce(p_reserve_cents, 0), 0), 0),
        match_count = match_count + case when coalesce(p_cost_cents, 0) > 0 then 1 else 0 end,
        updated_at = now(),
        kill_switch = (spend_cents + greatest(coalesce(p_cost_cents, 0), 0)) >= budget
          or kill_switch
    where day = today;
end;
$$;

-- Keep record_match_spend for callers that only know actual cost (no reserve).
create or replace function public.record_match_spend(p_cost_cents integer)
returns void
language plpgsql
security definer
as $$
begin
  perform public.finalize_match_spend(p_cost_cents, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Event log: serialize seq per match via row lock
-- ---------------------------------------------------------------------------

create or replace function public.append_match_event(
  p_match_id uuid,
  p_agent_id uuid,
  p_type public.event_type,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
as $$
declare
  next_seq integer;
begin
  perform 1 from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match not found: %', p_match_id;
  end if;

  select coalesce(max(seq), 0) + 1 into next_seq
    from public.match_events
   where match_id = p_match_id;

  insert into public.match_events (match_id, agent_id, seq, type, payload)
  values (p_match_id, p_agent_id, next_seq, p_type, coalesce(p_payload, '{}'::jsonb));

  return next_seq;
end;
$$;
