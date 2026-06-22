-- Brig — online world schema
-- Players (profiles) + the shared world Chronicle (lore written at the keep).
-- Row-Level Security: any signed-in player may read; you may only write as
-- yourself. Live co-presence uses Realtime channels (no table needed).

-- ---------------------------------------------------------------------------
-- profiles: one row per account, created automatically on signup
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  handle      text not null,
  created_at  timestamptz not null default now()
);

-- is_admin: server-authoritative moderator flag. Flip via SQL editor:
--   update public.profiles set is_admin = true where handle = '...';
-- Admins helm the great nao, hide lore, and are exempt from rate limits.
alter table public.profiles add column if not exists is_admin boolean not null default false;

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- lore_entries: the shared chronicle of the world, written at the keep
-- ---------------------------------------------------------------------------
create table if not exists public.lore_entries (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references auth.users (id) on delete cascade,
  author_handle text not null,
  title         text not null check (char_length(title) between 1 and 140),
  body          text not null check (char_length(body) between 1 and 8000),
  -- how this entry manifests in the 3D world, and where it stands.
  -- kind: 'monument' (a standing memory-stone), 'plaque', 'landmark'.
  -- pos_x / pos_z are world coordinates; NULL = auto-arrange in the keep's
  -- Court of Chronicles in creation order.
  kind          text not null default 'monument'
                  check (kind in ('monument', 'plaque', 'landmark')),
  pos_x         double precision,
  pos_z         double precision,
  created_at    timestamptz not null default now()
);

-- moderation: an admin may soft-hide any entry. Hidden rows stay in the DB
-- (so we can audit / restore) but vanish from the world for everyone but
-- admins. Stored as a nullable timestamp + the admin who pulled the stone.
alter table public.lore_entries add column if not exists hidden_at timestamptz;
alter table public.lore_entries add column if not exists hidden_by uuid references auth.users(id) on delete set null;

alter table public.lore_entries enable row level security;

-- the world's chronicle is public to READ (so visitors & monuments load),
-- but hidden entries vanish for everyone except admins (who need to see the
-- griefs they pulled, to audit / unhide).
drop policy if exists "lore readable by authenticated" on public.lore_entries;
drop policy if exists "lore readable by anyone" on public.lore_entries;
drop policy if exists "lore readable unless hidden" on public.lore_entries;
create policy "lore readable unless hidden"
  on public.lore_entries for select to anon, authenticated
  using (
    hidden_at is null
    or (auth.uid() is not null and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    ))
  );

drop policy if exists "authors insert own lore" on public.lore_entries;
create policy "authors insert own lore"
  on public.lore_entries for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "authors edit own lore" on public.lore_entries;
create policy "authors edit own lore"
  on public.lore_entries for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- admins may hide / unhide any entry (sets hidden_at + hidden_by).
drop policy if exists "admins moderate lore" on public.lore_entries;
create policy "admins moderate lore"
  on public.lore_entries for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

create index if not exists lore_entries_created_idx
  on public.lore_entries (created_at desc);

-- rate-limit: a non-admin author may raise at most 10 stones per hour.
-- This is the cheap mitigation against a Twitch viewer signing up and
-- mashing the inscribe button. Admins are exempt.
create or replace function private.enforce_lore_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
  admin_flag boolean;
begin
  select coalesce(is_admin, false) into admin_flag
    from public.profiles where id = new.author_id;
  if admin_flag then return new; end if;

  select count(*) into recent
    from public.lore_entries
    where author_id = new.author_id
      and created_at > now() - interval '1 hour';
  if recent >= 10 then
    raise exception 'rate_limit: too many inscriptions in the last hour — wait a while before raising another stone'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists lore_rate_limit on public.lore_entries;
create trigger lore_rate_limit
  before insert on public.lore_entries
  for each row execute function private.enforce_lore_rate_limit();

-- new lore broadcasts live to every connected client (idempotent)
do $$ begin
  alter publication supabase_realtime add table public.lore_entries;
exception when others then null; end $$;

-- ---------------------------------------------------------------------------
-- inventories: the player's hold (cargo / coin), keyed by a stable browser
-- identity. Guest world for now — the publishable (anon) key may read/write,
-- so saves work without a login. Tighten to auth.uid() when login lands.
-- ---------------------------------------------------------------------------
create table if not exists public.inventories (
  player_key  text primary key,
  handle      text,
  items       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.inventories enable row level security;

drop policy if exists "inventories readable" on public.inventories;
create policy "inventories readable"
  on public.inventories for select to anon, authenticated using (true);

drop policy if exists "inventories insertable" on public.inventories;
create policy "inventories insertable"
  on public.inventories for insert to anon, authenticated with check (true);

drop policy if exists "inventories updatable" on public.inventories;
create policy "inventories updatable"
  on public.inventories for update to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- player_state: progression that isn't cargo — quest progress, hull condition,
-- and which vessel the player owns. Keyed like inventories (a stable browser
-- identity, or acct:<uid> once signed in) so a signed-in player keeps progress
-- across devices. Anon-writable for the guest world, same as inventories.
-- ---------------------------------------------------------------------------
create table if not exists public.player_state (
  player_key  text primary key,
  handle      text,
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.player_state enable row level security;

drop policy if exists "player_state readable" on public.player_state;
create policy "player_state readable"
  on public.player_state for select to anon, authenticated using (true);

drop policy if exists "player_state insertable" on public.player_state;
create policy "player_state insertable"
  on public.player_state for insert to anon, authenticated with check (true);

drop policy if exists "player_state updatable" on public.player_state;
create policy "player_state updatable"
  on public.player_state for update to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- feedback: in-game bug reports & improvement ideas. Anyone (even a guest, not
-- signed in) may INSERT one — that's the point, zero friction. Only admins may
-- read them in-app; you otherwise review them in the Supabase dashboard (the
-- service role bypasses RLS). Players cannot read, edit or delete feedback.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('bug', 'idea')),
  message     text not null check (char_length(message) between 1 and 4000),
  handle      text,          -- optional: who sent it (free text / their game handle)
  player_key  text,          -- stable browser identity, for grouping a reporter's notes
  context     jsonb not null default '{}'::jsonb,  -- {place, vessel, atSea, version, ua, screen, url}
  status      text not null default 'open' check (status in ('open', 'triaged', 'done', 'wontfix')),
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- anyone may submit (anon + authenticated); no read for ordinary players
drop policy if exists "feedback insertable by anyone" on public.feedback;
create policy "feedback insertable by anyone"
  on public.feedback for insert to anon, authenticated with check (true);

-- admins may read + triage feedback in-app
drop policy if exists "admins read feedback" on public.feedback;
create policy "admins read feedback"
  on public.feedback for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "admins update feedback" on public.feedback;
create policy "admins update feedback"
  on public.feedback for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

create index if not exists feedback_created_idx on public.feedback (created_at desc);

-- rate-limit: at most 12 submissions per browser identity per hour, to blunt
-- spam from a public link (mirrors the lore rate-limit).
create or replace function private.enforce_feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare recent int;
begin
  if new.player_key is null then return new; end if;
  select count(*) into recent from public.feedback
    where player_key = new.player_key and created_at > now() - interval '1 hour';
  if recent >= 12 then
    raise exception 'rate_limit: too many submissions in the last hour — please wait a little'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_rate_limit on public.feedback;
create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function private.enforce_feedback_rate_limit();

-- ---------------------------------------------------------------------------
-- auto-create a profile when a new auth user signs up
-- (security definer, kept in a private, non-API-exposed schema)
-- ---------------------------------------------------------------------------
create schema if not exists private;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, handle)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'handle', ''),
             split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
