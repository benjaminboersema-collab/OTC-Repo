"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { totalWeeks, addDays } from "@/lib/scoring";

async function assertOwner(challengeId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: m } = await supabase
    .from("memberships").select("role").eq("challenge_id", challengeId).eq("user_id", user.id).maybeSingle();
  if (m?.role !== "owner") throw new Error("Owners only");
  return supabase;
}

function revalidateAll(id: string) {
  revalidatePath(`/c/${id}/owner`);
  revalidatePath(`/c/${id}/rules`);
  revalidatePath(`/c/${id}/checkin`);
  revalidatePath(`/c/${id}`);
}

export async function updateSettings(challengeId: string, formData: FormData) {
  const supabase = await assertOwner(challengeId);
  const num = (k: string, d: number) => {
    const v = parseFloat((formData.get(k) as string) ?? "");
    return Number.isFinite(v) ? v : d;
  };
  const start_date = (formData.get("start_date") as string);
  const end_date = (formData.get("end_date") as string) || null;
  const weeks = end_date ? totalWeeks({ start_date, weeks: 10, end_date }) : Math.max(1, Math.round(num("weeks", 10)));

  await supabase.from("challenges").update({
    name: ((formData.get("name") as string) || "Our Team Challenge").trim(),
    start_date,
    end_date: end_date || addDays(start_date, weeks * 7 - 1),
    end_time: ((formData.get("end_time") as string) || "18:00"),
    weeks,
    timezone: ((formData.get("timezone") as string) || "Africa/Johannesburg").trim(),
    buyin_amount: Math.max(0, num("buyin", 0)),
    currency: ((formData.get("currency") as string) || "ZAR").trim(),
    pt_workout: Math.max(0, Math.round(num("pt_workout", 5))),
    pt_clean: Math.max(0, Math.round(num("pt_clean", 3))),
    pt_fast: Math.max(0, Math.round(num("pt_fast", 5))),
    pt_litre: Math.max(0, Math.round(num("pt_litre", 1))),
  }).eq("id", challengeId);
  revalidateAll(challengeId);
}

export async function regenerateInvite(challengeId: string) {
  const supabase = await assertOwner(challengeId);
  const bytes = new Uint32Array(5);
  (globalThis.crypto as Crypto).getRandomValues(bytes);
  const token = Array.from(bytes, (n) => n.toString(16).padStart(8, "0")).join("").slice(0, 18);
  await supabase.from("challenges").update({ invite_token: token }).eq("id", challengeId);
  revalidatePath(`/c/${challengeId}/owner`);
}

export async function removeMember(challengeId: string, userId: string) {
  const supabase = await assertOwner(challengeId);
  await supabase.from("memberships").delete()
    .eq("challenge_id", challengeId).eq("user_id", userId).eq("role", "member");
  revalidateAll(challengeId);
}

/** Save every week's bonus challenge in one go. Blank title = no bonus that week. */
export async function saveBonuses(challengeId: string, formData: FormData) {
  const supabase = await assertOwner(challengeId);
  const { data: ch } = await supabase
    .from("challenges").select("weeks").eq("id", challengeId).single();
  const weeks = ch?.weeks ?? 10;

  const upserts: { challenge_id: string; week_no: number; title: string; points: number }[] = [];
  const clears: number[] = [];

  for (let w = 1; w <= weeks; w++) {
    const title = ((formData.get(`title_${w}`) as string) ?? "").trim();
    const pts = parseInt((formData.get(`points_${w}`) as string) ?? "2", 10);
    if (title) {
      upserts.push({ challenge_id: challengeId, week_no: w, title, points: Math.max(0, Number.isFinite(pts) ? pts : 2) });
    } else {
      clears.push(w);
    }
  }

  if (upserts.length) {
    await supabase.from("bonus_challenges").upsert(upserts, { onConflict: "challenge_id,week_no" });
  }
  if (clears.length) {
    await supabase.from("bonus_challenges").delete().eq("challenge_id", challengeId).in("week_no", clears);
  }
  revalidateAll(challengeId);
}

/** Wipe every logged entry — a clean slate before the challenge starts. */
export async function resetAllScores(challengeId: string) {
  const supabase = await assertOwner(challengeId);
  await supabase.from("entries").delete().eq("challenge_id", challengeId);
  revalidateAll(challengeId);
}
