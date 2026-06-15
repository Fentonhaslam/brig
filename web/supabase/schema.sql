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

alter table public.lore_entries enable row level security;

-- the world's chronicle is public to READ (so visitors & monuments load);
-- writing still requires being signed in as yourself (policies below).
drop policy if exists "lore readable by authenticated" on public.lore_entries;
drop policy if exists "lore readable by anyone" on public.lore_entries;
create policy "lore readable by anyone"
  on public.lore_entries for select to anon, authenticated using (true);

drop policy if exists "authors insert own lore" on public.lore_entries;
create policy "authors insert own lore"
  on public.lore_entries for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "authors edit own lore" on public.lore_entries;
create policy "authors edit own lore"
  on public.lore_entries for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

create index if not exists lore_entries_created_idx
  on public.lore_entries (created_at desc);

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
