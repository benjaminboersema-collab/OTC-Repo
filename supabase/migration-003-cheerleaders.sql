-- ============================================================================
--  Migration 003 — cheerleading section
--
--  A cheerleader is a member of the challenge who does NOT compete:
--    * they still sign in, see the board and log their own points
--    * they are ranked separately and never appear in the competing ranks
--    * they do not count towards the player count or the pot
--
--  Safe to run more than once.
-- ============================================================================

-- 1. the flag itself -------------------------------------------------------
alter table public.memberships
  add column if not exists cheerleader boolean not null default false;

-- 2. the owner needs to be able to write it --------------------------------
-- memberships had select / insert / delete policies but no UPDATE policy, so
-- RLS denied every update. Owners may update any membership row in their own
-- challenge; nobody else may update any.
drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update using (is_owner(challenge_id)) with check (is_owner(challenge_id));

-- 3. board queries filter on it --------------------------------------------
create index if not exists memberships_challenge_cheerleader_idx
  on public.memberships (challenge_id, cheerleader);
