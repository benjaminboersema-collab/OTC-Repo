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
