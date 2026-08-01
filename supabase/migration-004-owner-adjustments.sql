-- ============================================================================
--  Migration 004 — owner manual point adjustments
--
--  Adds a fifth entry kind, 'adjustment': a single owner-written row per player
--  per challenge holding a manual correction (may be negative). It flows into
--  the leaderboard total like any other entry.
--
--  SECURITY NOTE — this migration also TIGHTENS the member policies. Before it,
--  entries_write only checked `user_id = auth.uid()`, so once 'adjustment'
--  exists as a kind any member could insert an adjustment row for themselves
--  and award themselves arbitrary points. The `kind <> 'adjustment'` clauses
--  below are what stop that. Do not drop them.
--
--  Safe to run more than once.
-- ============================================================================

-- 1. allow the new kind ----------------------------------------------------
-- Drop by discovery, not by assumed name: if the original check constraint is
-- called something other than entries_kind_check, a plain
-- `drop constraint if exists entries_kind_check` is a silent no-op and the old
-- constraint would keep rejecting 'adjustment'.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.entries'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.entries drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.entries add constraint entries_kind_check
  check (kind in ('workout','nutrition','hydration','bonus','adjustment'));

-- 2. exactly one adjustment row per player per challenge -------------------
create unique index if not exists entries_one_adjustment_per_user
  on public.entries(challenge_id, user_id) where (kind = 'adjustment');

-- 3. members may write their own entries, but never an adjustment ----------
drop policy if exists entries_write on public.entries;
create policy entries_write on public.entries for insert
  with check (user_id = auth.uid() and is_member(challenge_id) and kind <> 'adjustment');

drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries for update
  using (user_id = auth.uid() and kind <> 'adjustment');

drop policy if exists entries_delete on public.entries;
create policy entries_delete on public.entries for delete
  using (user_id = auth.uid() and kind <> 'adjustment');

-- 4. the owner may write adjustments — and only adjustments ----------------
drop policy if exists entries_owner_adjust_insert on public.entries;
create policy entries_owner_adjust_insert on public.entries for insert
  with check (kind = 'adjustment' and is_owner(challenge_id));

drop policy if exists entries_owner_adjust_update on public.entries;
create policy entries_owner_adjust_update on public.entries for update
  using (kind = 'adjustment' and is_owner(challenge_id))
  with check (kind = 'adjustment' and is_owner(challenge_id));

drop policy if exists entries_owner_adjust_delete on public.entries;
create policy entries_owner_adjust_delete on public.entries for delete
  using (kind = 'adjustment' and is_owner(challenge_id));
