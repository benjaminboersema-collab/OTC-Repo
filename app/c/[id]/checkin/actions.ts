"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { startOfWeekYMD, addDays } from "@/lib/scoring";
import type { Challenge, NutritionState } from "@/lib/types";

async function ctx(challengeId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: challenge } = await supabase
    .from("challenges").select("*").eq("id", challengeId).single();
  return { supabase, user, challenge: challenge as Challenge };
}

export async function logWorkout(challengeId: string, day: string, photoUrl: string | null) {
  const { supabase, user, challenge } = await ctx(challengeId);

  // enforce optional bonus cap (max scoring workouts per week)
  let points = challenge.pt_workout;
  if (challenge.bonus_cap && challenge.bonus_cap > 0) {
    const ws = startOfWeekYMD(day);
    const we = addDays(ws, 6);
    const { count } = await supabase
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", challengeId).eq("user_id", user.id).eq("kind", "workout")
      .gte("day", ws).lte("day", we);
    const maxScoring = 5 + challenge.bonus_cap;
    if ((count ?? 0) >= maxScoring) points = 0; // logged but no longer scores
  }

  await supabase.from("entries").insert({
    challenge_id: challengeId, user_id: user.id, day, kind: "workout",
    points, photo_url: photoUrl,
  });
  revalidatePath(`/c/${challengeId}/checkin`);
}

export async function removeWorkout(challengeId: string, entryId: string) {
  const { supabase } = await ctx(challengeId);
  await supabase.from("entries").delete().eq("id", entryId);
  revalidatePath(`/c/${challengeId}/checkin`);
}

export async function setNutrition(challengeId: string, day: string, state: NutritionState | null) {
  const { supabase, user, challenge } = await ctx(challengeId);
  // one nutrition row per day: clear then set
  await supabase.from("entries").delete()
    .eq("challenge_id", challengeId).eq("user_id", user.id).eq("kind", "nutrition").eq("day", day);
  if (state) {
    const points = state === "fast" ? challenge.pt_fast : challenge.pt_clean;
    await supabase.from("entries").insert({
      challenge_id: challengeId, user_id: user.id, day, kind: "nutrition", detail: state, points,
    });
  }
  revalidatePath(`/c/${challengeId}/checkin`);
}

export async function setHydration(challengeId: string, day: string, litres: number) {
  const { supabase, user, challenge } = await ctx(challengeId);
  await supabase.from("entries").delete()
    .eq("challenge_id", challengeId).eq("user_id", user.id).eq("kind", "hydration").eq("day", day);
  if (litres > 0) {
    await supabase.from("entries").insert({
      challenge_id: challengeId, user_id: user.id, day, kind: "hydration",
      detail: String(litres), points: litres * challenge.pt_litre,
    });
  }
  revalidatePath(`/c/${challengeId}/checkin`);
}
