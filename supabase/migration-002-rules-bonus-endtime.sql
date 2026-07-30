-- ============================================================================
--  OTC migration 002 — run this ONCE on your existing Supabase database.
--  Safe to re-run (every step is idempotent).
--
--  Adds: challenge end date + logging cut-off time, timezone, one-row-per-day
--        entries (exercise stores a session count 1-3), per-week bonus
--        challenges, and email column privacy.
-- ============================================================================

-- 1. Challenge end date, closing time, timezone -----------------------------
alter table public.challenges add column if not exists end_date date;
alter table public.challenges add column if not exists end_time time not null default '18:00';
alter table public.challenges add column if not exists timezone text not null default 'Africa/Johannesburg';

update public.challenges
   set end_date = start_date + (weeks * 7 - 1)
 where end_date is null;

-- 2. Clear existing entries -------------------------------------------------
--    Exercise changes from "one row per workout" to "one row per day with a
--    session count", so old rows can't carry over. This also resets everyone
--    to zero for the start of the challenge.
delete from public.entries;

-- 3. Exactly one row per kind, per user, per day ----------------------------
create unique index if not exists entries_one_workout_per_day
  on public.entries(challenge_id, user_id, day) where (kind = 'workout');
create unique index if not exists entries_one_nutrition_per_day
  on public.entries(challenge_id, user_id, day) where (kind = 'nutrition');
create unique index if not exists entries_one_hydration_per_day
  on public.entries(challenge_id, user_id, day) where (kind = 'hydration');
create unique index if not exists entries_one_bonus_per_day
  on public.entries(challenge_id, user_id, day) where (kind = 'bonus');

-- 4. Email privacy ----------------------------------------------------------
--    Row-level RLS alone let team-mates read each other's email address.
revoke select on public.profiles from anon, authenticated;
grant  select (id, display_name, created_at) on public.profiles to anon, authenticated;

-- 5. Weekly bonus challenges (one per week, owner-editable) -----------------
create table if not exists public.bonus_challenges (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  week_no      int  not null,
  title        text not null,
  points       int  not null default 2,
  created_at   timestamptz not null default now(),
  unique (challenge_id, week_no)
);

alter table public.bonus_challenges enable row level security;

drop policy if exists bonus_select on public.bonus_challenges;
create policy bonus_select on public.bonus_challenges
  for select using (is_member(challenge_id));

drop policy if exists bonus_write on public.bonus_challenges;
create policy bonus_write on public.bonus_challenges
  for all using (is_owner(challenge_id)) with check (is_owner(challenge_id));

-- Done. Expect "Success. No rows returned".
