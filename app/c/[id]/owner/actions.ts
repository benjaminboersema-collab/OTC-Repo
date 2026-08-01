"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

/**
 * Move a player into or out of the cheerleading section.
 * Cheerleaders keep every point they have logged and can keep logging — they
 * are just ranked separately and left out of the player count and the pot.
 */
export async function setCheerleader(challengeId: string, userId: string, cheerleader: boolean) {
  const supabase = await assertOwner(challengeId);
  const { error } = await supabase
    .from("memberships")
    .update({ cheerleader })
    .eq("challenge_id", challengeId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
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

/**
 * Manual point adjustments, one per player, positive or negative.
 * Stored as a single `adjustment` entry per player dated on the challenge's
 * start day, so it lands in the season total like any other entry. A value of
 * 0 removes the row entirely rather than leaving a no-op sitting in the table.
 */
export async function saveAdjustments(challengeId: string, formData: FormData) {
  const supabase = await assertOwner(challengeId);

  const { data: ch } = await supabase
    .from("challenges").select("start_date").eq("id", challengeId).single();
  const day = (ch?.start_date as string) ?? new Date().toISOString().slice(0, 10);

  const { data: members } = await supabase
    .from("memberships").select("user_id").eq("challenge_id", challengeId);

  // what's already stored, so we only touch the players whose value changed
  const { data: existing } = await supabase
    .from("entries").select("user_id, points")
    .eq("challenge_id", challengeId).eq("kind", "adjustment");
  const current = new Map(((existing ?? []) as { user_id: string; points: number }[])
    .map((e) => [e.user_id, e.points]));

  const inserts: { challenge_id: string; user_id: string; day: string; kind: string; detail: string; points: number }[] = [];
  const clears: string[] = [];

  for (const m of (members ?? []) as { user_id: string }[]) {
    const raw = (formData.get(`adj_${m.user_id}`) as string) ?? "";
    const parsed = parseInt(raw.trim(), 10);
    const want = Number.isFinite(parsed) ? parsed : 0;
    const have = current.get(m.user_id) ?? 0;
    if (want === have) continue;                       // untouched — leave it alone
    if (current.has(m.user_id)) clears.push(m.user_id); // replace: delete then insert
    if (want !== 0) {
      inserts.push({
        challenge_id: challengeId, user_id: m.user_id, day,
        kind: "adjustment", detail: "manual", points: want,
      });
    }
  }

  // Delete-then-insert rather than upsert: the uniqueness guard is a PARTIAL
  // index (where kind = 'adjustment'), which PostgREST's on_conflict can't target.
  if (clears.length) {
    const { error } = await supabase.from("entries").delete()
      .eq("challenge_id", challengeId).eq("kind", "adjustment").in("user_id", clears);
    if (error) throw new Error(error.message);
  }
  if (inserts.length) {
    const { error } = await supabase.from("entries").insert(inserts);
    if (error) throw new Error(`Adjustments not saved: ${error.message}`);
  }
  revalidateAll(challengeId);
}

/** Wipe every logged entry — a clean slate before the challenge starts. */
export async function resetAllScores(challengeId: string) {
  const supabase = await assertOwner(challengeId);
  await supabase.from("entries").delete().eq("challenge_id", challengeId);
  revalidateAll(challengeId);
}

export async function deleteChallenge(challengeId: string, formData: FormData) {
  const supabase = await assertOwner(challengeId);

  const { data: ch } = await supabase
    .from("challenges").select("name").eq("id", challengeId).single();
  if (!ch) throw new Error("Challenge not found");

  const typed = ((formData.get("confirm_name") as string) || "").trim();
  if (typed !== (ch.name as string).trim()) {
    throw new Error("Type the challenge name exactly to confirm deletion");
  }

  const { error } = await supabase.from("challenges").delete().eq("id", challengeId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
