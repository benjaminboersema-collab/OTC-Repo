-- ============================================================================
--  OTC — Our Team Challenge : Supabase schema
--  Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- ============================================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;

-- ============================================================================
--  TABLES
-- ============================================================================

-- Profile per auth user (auto-created by trigger below)
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);

-- A challenge (one per team / season)
create table if not exists public.challenges (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  name         text not null default 'Our Team Challenge',
  start_date   date not null default current_date,
  weeks        int  not null default 10,
  timezone     text not null default 'Africa/Johannesburg',
  buyin_amount numeric not null default 0,
  currency     text not null default 'ZAR',
  -- configurable scoring
  pt_workout   int  not null default 5,   -- points per workout
  pt_clean     int  not null default 3,   -- points per clean-eating day
  pt_fast      int  not null default 5,   -- points per full-day fast
  pt_litre     int  not null default 1,   -- points per litre of water
  bonus_cap    int  not null default 0,   -- max extra workouts/week that score (0 = unlimited)
  invite_token text not null unique default encode(gen_random_bytes(9), 'hex'),
  created_at   timestamptz not null default now()
);

-- Membership: who is in a challenge and their role
create table if not exists public.memberships (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','member')),
  joined_at    timestamptz not null default now(),
  unique (challenge_id, user_id)
);

-- Every scored action lives here as one row with pre-computed points
create table if not exists public.entries (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  day          date not null default current_date,
  kind         text not null check (kind in ('workout','nutrition','hydration','bonus')),
  detail       text,          -- 'clean' | 'fast' for nutrition; litre count for hydration; note for bonus
  points       int  not null default 0,
  photo_url    text,          -- proof photo (workouts)
  created_at   timestamptz not null default now()
);
create index if not exists entries_challenge_user_idx on public.entries(challenge_id, user_id);

-- one nutrition row and one hydration row per user per day
create unique index if not exists entries_one_nutrition_per_day
  on public.entries(challenge_id, user_id, day) where (kind = 'nutrition');
create unique index if not exists entries_one_hydration_per_day
  on public.entries(challenge_id, user_id, day) where (kind = 'hydration');

-- Weekly bonus challenge posted by the owner
create table if not exists public.bonus_challenges (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  week_no      int  not null,
  title        text not null,
  points       int  not null default 10,
  created_at   timestamptz not null default now(),
  unique (challenge_id, week_no)
);

-- ============================================================================
--  HELPER FUNCTIONS (security definer to avoid RLS recursion)
-- ============================================================================
create or replace function public.is_member(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from memberships where challenge_id = cid and user_id = auth.uid());
$$;

create or replace function public.is_owner(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from memberships where challenge_id = cid and user_id = auth.uid() and role = 'owner');
$$;

-- Look up a challenge by its invite token (no membership required)
create or replace function public.challenge_by_invite(token text)
returns table (id uuid, name text, start_date date, weeks int, member_count bigint)
language sql security definer stable set search_path = public as $$
  select c.id, c.name, c.start_date, c.weeks,
         (select count(*) from memberships m where m.challenge_id = c.id)
  from challenges c where c.invite_token = token;
$$;

-- Join a challenge via invite token; returns the challenge id
create or replace function public.join_by_invite(token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from challenges where invite_token = token;
  if cid is null then raise exception 'Invalid invite link'; end if;
  insert into memberships (challenge_id, user_id, role)
  values (cid, auth.uid(), 'member')
  on conflict (challenge_id, user_id) do nothing;
  return cid;
end;
$$;

-- ============================================================================
--  NEW-USER TRIGGER : create a profile row automatically
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles         enable row level security;
alter table public.challenges       enable row level security;
alter table public.memberships      enable row level security;
alter table public.entries          enable row level security;
alter table public.bonus_challenges enable row level security;

-- profiles: you can see yourself + anyone who shares a challenge with you
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from memberships m1
    join memberships m2 on m1.challenge_id = m2.challenge_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  )
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid());

-- Column-level privacy: RLS is row-level only, so without this a member could
-- read co-members' EMAIL via the profiles table. Restrict the readable columns
-- to id + display_name (+ created_at). Email stays in auth.users, service-role only.
revoke select on public.profiles from anon, authenticated;
grant  select (id, display_name, created_at) on public.profiles to anon, authenticated;

-- challenges
drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges for select using (is_member(id));
drop policy if exists challenges_insert on public.challenges;
create policy challenges_insert on public.challenges for insert with check (owner_id = auth.uid());
drop policy if exists challenges_update on public.challenges;
create policy challenges_update on public.challenges for update using (is_owner(id));
drop policy if exists challenges_delete on public.challenges;
create policy challenges_delete on public.challenges for delete using (is_owner(id));

-- memberships
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships for select using (is_member(challenge_id));
drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships for insert with check (user_id = auth.uid());
drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships for delete using (is_owner(challenge_id) or user_id = auth.uid());

-- entries
drop policy if exists entries_select on public.entries;
create policy entries_select on public.entries for select using (is_member(challenge_id));
drop policy if exists entries_write on public.entries;
create policy entries_write on public.entries for insert with check (user_id = auth.uid() and is_member(challenge_id));
drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries for update using (user_id = auth.uid());
drop policy if exists entries_delete on public.entries;
create policy entries_delete on public.entries for delete using (user_id = auth.uid());

-- bonus challenges
drop policy if exists bonus_select on public.bonus_challenges;
create policy bonus_select on public.bonus_challenges for select using (is_member(challenge_id));
drop policy if exists bonus_write on public.bonus_challenges;
create policy bonus_write on public.bonus_challenges for all using (is_owner(challenge_id)) with check (is_owner(challenge_id));

-- ============================================================================
--  STORAGE : bucket for proof photos
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;

drop policy if exists proofs_read on storage.objects;
create policy proofs_read on storage.objects for select using (bucket_id = 'proofs');
drop policy if exists proofs_write on storage.objects;
create policy proofs_write on storage.objects for insert to authenticated with check (bucket_id = 'proofs');
