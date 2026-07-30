import type { Entry } from "./types";

/** ---------- Civil-date helpers (timezone-correct, week runs Mon–Sun) ----------
 * A "civil date" is a 'YYYY-MM-DD' string interpreted in the challenge's timezone.
 * We anchor every date at 12:00 UTC so DST / offset shifts can never bump the day.
 */

/** Today's civil date in the given IANA timezone, e.g. "2026-08-01". */
export function todayYMD(timeZone: string): string {
  // en-CA renders as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function noonUTC(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}

export function addDays(ymd: string, n: number): string {
  const d = noonUTC(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayMon0(ymd: string): number {
  return (noonUTC(ymd).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
}

export function startOfWeekYMD(ymd: string): string {
  return addDays(ymd, -weekdayMon0(ymd));
}

/** The seven civil dates (Mon…Sun) of the week containing `anchorYMD`. */
export function weekDaysYMD(anchorYMD: string): string[] {
  const start = startOfWeekYMD(anchorYMD);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Which challenge week a civil date falls in (1-based). */
export function weekNumberYMD(startDate: string, dateYMD: string): number {
  const s = noonUTC(startOfWeekYMD(startDate)).getTime();
  const d = noonUTC(startOfWeekYMD(dateYMD)).getTime();
  return Math.floor((d - s) / (7 * 86_400_000)) + 1;
}

/** The challenge's last day — explicit end_date if set, else derived from weeks. */
export function endYMD(c: { start_date: string; weeks: number; end_date?: string | null }): string {
  return c.end_date || addDays(c.start_date, c.weeks * 7 - 1);
}

/** How many weeks the challenge actually spans (start → end, inclusive). */
export function totalWeeks(c: { start_date: string; weeks: number; end_date?: string | null }): number {
  if (!c.end_date) return c.weeks;
  const s = noonUTC(startOfWeekYMD(c.start_date)).getTime();
  const e = noonUTC(startOfWeekYMD(c.end_date)).getTime();
  return Math.max(1, Math.round((e - s) / (7 * 86_400_000)) + 1);
}

/** "9 Oct 2026" — for display. */
export function prettyDate(ymd: string, withYear = true): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1];
  return withYear ? `${d} ${M} ${y}` : `${d} ${M}`;
}

/** "18:00:00" -> "18:00" */
export function prettyTime(t: string): string {
  return (t || "18:00").slice(0, 5);
}

/** Current wall-clock "HH:MM" in the challenge's timezone. */
export function nowHM(timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

type Window = {
  start_date: string; weeks: number; end_date?: string | null;
  end_time?: string; timezone?: string;
};

/** Has the challenge finished? (past the end date, or past the cut-off on the last day) */
export function isClosed(c: Window): boolean {
  const tz = c.timezone || "Africa/Johannesburg";
  const today = todayYMD(tz);
  const end = endYMD(c);
  if (today > end) return true;
  if (today < end) return false;
  return nowHM(tz) >= prettyTime(c.end_time || "18:00");
}

/** Is this civil date inside the challenge window (and still loggable)? */
export function canLogDay(c: Window, day: string): boolean {
  if (day < c.start_date) return false;      // before the starting gun
  if (day > endYMD(c)) return false;         // after the finish
  return !isClosed(c);                       // logging has closed for everyone
}

/** ---------- Scoring ---------- */
export function totalPoints(entries: Entry[]): number {
  return entries.reduce((sum, e) => sum + e.points, 0);
}

export interface SourceBreakdown {
  workout: number;
  nutrition: number;
  hydration: number;
  bonus: number;
  total: number;
}

export function breakdown(entries: Entry[]): SourceBreakdown {
  const b: SourceBreakdown = { workout: 0, nutrition: 0, hydration: 0, bonus: 0, total: 0 };
  for (const e of entries) {
    b[e.kind] += e.points;
    b.total += e.points;
  }
  return b;
}

/** Points earned by each user in a challenge -> leaderboard rows */
export interface ScoreRow {
  user_id: string;
  points: number;
}
export function leaderboard(entries: Entry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.user_id, (m.get(e.user_id) ?? 0) + e.points);
  return m;
}

/** Consecutive nutrition days (clean or fast) ending at the latest logged day */
export function nutritionStreak(entries: Entry[]): number {
  const days = entries
    .filter((e) => e.kind === "nutrition")
    .map((e) => e.day)
    .sort();
  if (days.length === 0) return 0;
  let streak = 1;
  for (let i = days.length - 1; i > 0; i--) {
    const cur = new Date(days[i]);
    const prev = new Date(days[i - 1]);
    const gap = (cur.getTime() - prev.getTime()) / 86_400_000;
    if (gap === 1) streak++;
    else break;
  }
  return streak;
}
