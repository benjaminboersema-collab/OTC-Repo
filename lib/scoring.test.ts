/**
 * Pure-logic tests for the scoring helpers.
 *   npm test        (tsx lib/scoring.test.ts)
 * No database, no network — just the maths the leaderboard depends on.
 */
import assert from "node:assert/strict";
import type { Entry } from "./types";
import {
  addDays, weekNumberYMD, endYMD, totalWeeks, canLogDay,
  leaderboard, breakdown, dayLog, adjustmentTotal, nutritionStreak,
} from "./scoring";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`FAIL  ${name}`);
    throw err;
  }
}

const e = (p: Partial<Entry>): Entry => ({
  id: Math.random().toString(36).slice(2),
  challenge_id: "c1",
  user_id: "u1",
  day: "2026-08-01",
  kind: "workout",
  detail: null,
  points: 0,
  photo_url: null,
  created_at: "",
  ...p,
});

/* ---------- dates ---------- */

test("addDays crosses a month boundary", () => {
  assert.equal(addDays("2026-07-31", 1), "2026-08-01");
  assert.equal(addDays("2026-08-01", -1), "2026-07-31");
});

test("weekNumberYMD is 1-based and Monday-anchored", () => {
  // 2026-08-03 is a Monday
  assert.equal(weekNumberYMD("2026-08-03", "2026-08-03"), 1);
  assert.equal(weekNumberYMD("2026-08-03", "2026-08-09"), 1); // Sunday, same week
  assert.equal(weekNumberYMD("2026-08-03", "2026-08-10"), 2);
});

test("endYMD prefers an explicit end_date", () => {
  assert.equal(endYMD({ start_date: "2026-08-03", weeks: 2 }), "2026-08-16");
  assert.equal(endYMD({ start_date: "2026-08-03", weeks: 2, end_date: "2026-08-20" }), "2026-08-20");
  assert.equal(totalWeeks({ start_date: "2026-08-03", weeks: 2, end_date: "2026-08-20" }), 3);
});

test("canLogDay refuses days outside the window", () => {
  const c = { start_date: "2026-08-03", weeks: 2, timezone: "Africa/Johannesburg", end_time: "18:00" };
  assert.equal(canLogDay(c, "2026-08-02"), false, "before the start");
  assert.equal(canLogDay(c, "2026-08-17"), false, "after the end");
});

/* ---------- totals ---------- */

test("leaderboard sums every kind, adjustments included", () => {
  const m = leaderboard([
    e({ user_id: "a", kind: "workout", points: 10 }),
    e({ user_id: "a", kind: "hydration", points: 3 }),
    e({ user_id: "b", kind: "workout", points: 5 }),
    e({ user_id: "b", kind: "adjustment", points: 20 }),
  ]);
  assert.equal(m.get("a"), 13);
  assert.equal(m.get("b"), 25);
});

test("a negative adjustment takes points away", () => {
  const m = leaderboard([
    e({ user_id: "a", kind: "workout", points: 30 }),
    e({ user_id: "a", kind: "adjustment", points: -12 }),
  ]);
  assert.equal(m.get("a"), 18);
});

test("breakdown keeps adjustment in its own bucket but inside the total", () => {
  const b = breakdown([
    e({ kind: "workout", points: 10 }),
    e({ kind: "nutrition", points: 3 }),
    e({ kind: "hydration", points: 2 }),
    e({ kind: "bonus", points: 4 }),
    e({ kind: "adjustment", points: -5 }),
  ]);
  assert.equal(b.workout, 10);
  assert.equal(b.nutrition, 3);
  assert.equal(b.hydration, 2);
  assert.equal(b.bonus, 4);
  assert.equal(b.adjustment, -5);
  assert.equal(b.total, 14);
});

test("adjustmentTotal ignores everything else", () => {
  assert.equal(adjustmentTotal([
    e({ kind: "workout", points: 99 }),
    e({ kind: "adjustment", points: 7 }),
  ]), 7);
  assert.equal(adjustmentTotal([e({ kind: "workout", points: 99 })]), 0);
});

/* ---------- the tap-a-name popup ---------- */

test("dayLog picks out one day and leaves adjustments out of it", () => {
  const entries = [
    e({ day: "2026-08-01", kind: "workout", detail: "2", points: 10 }),
    e({ day: "2026-08-01", kind: "nutrition", detail: "fast", points: 5 }),
    e({ day: "2026-08-01", kind: "hydration", detail: "3", points: 3 }),
    e({ day: "2026-08-02", kind: "workout", detail: "1", points: 5 }),
    // stored on the same day, but it belongs to the season, not the day
    e({ day: "2026-08-01", kind: "adjustment", points: 50 }),
  ];

  const d1 = dayLog(entries, "2026-08-01");
  assert.equal(d1.count, 3, "adjustment must not be counted as a logged item");
  assert.equal(d1.total, 18, "adjustment must not inflate the day total");
  assert.equal(d1.workout?.detail, "2");
  assert.equal(d1.nutrition?.detail, "fast");
  assert.equal(d1.hydration?.detail, "3");
  assert.equal(d1.bonus, null);

  const d2 = dayLog(entries, "2026-08-02");
  assert.equal(d2.count, 1);
  assert.equal(d2.total, 5);

  const empty = dayLog(entries, "2026-08-09");
  assert.equal(empty.count, 0);
  assert.equal(empty.total, 0);
  assert.equal(empty.workout, null);
});

/* ---------- streaks ---------- */

test("nutritionStreak counts consecutive days only", () => {
  assert.equal(nutritionStreak([
    e({ day: "2026-08-01", kind: "nutrition", points: 3 }),
    e({ day: "2026-08-02", kind: "nutrition", points: 3 }),
    e({ day: "2026-08-03", kind: "nutrition", points: 3 }),
  ]), 3);
  assert.equal(nutritionStreak([
    e({ day: "2026-08-01", kind: "nutrition", points: 3 }),
    e({ day: "2026-08-03", kind: "nutrition", points: 3 }),
  ]), 1, "a gap breaks the streak");
  assert.equal(nutritionStreak([e({ kind: "workout", points: 5 })]), 0);
});

console.log(`${passed} tests passed`);
