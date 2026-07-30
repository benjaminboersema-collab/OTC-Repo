"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { weekNumberYMD, canLogDay } from "@/lib/scoring";
import { EX_MAX, type Challenge, type NutritionState } from "@/lib/types";

async function ctx(challengeId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: challenge } = await supabase
    .from("challenges").select("*").eq("id", challengeId).single();
  return { supabase, user, challenge: challenge as Challenge };
}

/** Replace the single row of `kind` for that day (or clear it). */
async function setDayEntry(
  challengeId: string,
  kind: "workout" | "nutrition" | "hydration" | "bonus",
  day: string,
  detail: string | null,
  points: number
) {
  const { supabase, user, challenge } = await ctx(challengeId);

  // Server-side guard: no logging before the start, after the end, or once the
  // cut-off time has passed. Without this the closing time is only decoration.
  if (!canLogDay(challenge, day)) {
    throw new Error("Logging is closed for that day.");
  }

  await supabase.from("entries").delete()
    .eq("challenge_id", challengeId).eq("user_id", user.id).eq("kind", kind).eq("day", day);
  if (detail !== null) {
    await supabase.from("entries").insert({
      challenge_id: challengeId, user_id: user.id, day, kind, detail, points,
    });
  }
  revalidatePath(`/c/${challengeId}/checkin`);
}

/** Exercise: 0–3 sessions in a day, `pt_workout` each. 0 clears the day. */
export async function setWorkouts(challengeId: string, day: string, sessions: number) {
  const { challenge } = await ctx(challengeId);
  const n = Math.max(0, Math.min(EX_MAX, Math.round(sessions)));
  await setDayEntry(challengeId, "workout", day, n === 0 ? null : String(n), n * challenge.pt_workout);
}

export async function setNutrition(challengeId: string, day: string, state: NutritionState | null) {
  const { challenge } = await ctx(challengeId);
  const points = state === "fast" ? challenge.pt_fast : state === "clean" ? challenge.pt_clean : 0;
  await setDayEntry(challengeId, "nutrition", day, state, points);
}

export async function setHydration(challengeId: string, day: string, litres: number) {
  const { challenge } = await ctx(challengeId);
  const l = Math.max(0, Math.round(litres));
  await setDayEntry(challengeId, "hydration", day, l === 0 ? null : String(l), l * challenge.pt_litre);
}

/** Weekly bonus: tick a day off. Points come from that week's bonus challenge. */
export async function setBonus(challengeId: string, day: string, on: boolean) {
  const { supabase, challenge } = await ctx(challengeId);
  const week = weekNumberYMD(challenge.start_date, day);
  const { data: bonus } = await supabase
    .from("bonus_challenges").select("points, title")
    .eq("challenge_id", challengeId).eq("week_no", week).maybeSingle();

  // no challenge set for this week -> nothing to score
  if (!bonus?.title) {
    await setDayEntry(challengeId, "bonus", day, null, 0);
    return;
  }
  await setDayEntry(challengeId, "bonus", day, on ? String(week) : null, on ? bonus.points : 0);
}
