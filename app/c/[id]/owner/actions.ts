"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function assertOwner(challengeId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: m } = await supabase
    .from("memberships").select("role").eq("challenge_id", challengeId).eq("user_id", user.id).maybeSingle();
  if (m?.role !== "owner") throw new Error("Owners only");
  return supabase;
}

export async function updateSettings(challengeId: string, formData: FormData) {
  const supabase = await assertOwner(challengeId);
  const num = (k: string, d: number) => {
    const v = parseFloat((formData.get(k) as string) ?? "");
    return Number.isFinite(v) ? v : d;
  };
  await supabase.from("challenges").update({
    name: ((formData.get("name") as string) || "Our Team Challenge").trim(),
    start_date: (formData.get("start_date") as string),
    weeks: Math.max(1, Math.round(num("weeks", 10))),
    timezone: ((formData.get("timezone") as string) || "Africa/Johannesburg").trim(),
    buyin_amount: Math.max(0, num("buyin", 0)),
    currency: ((formData.get("currency") as string) || "ZAR").trim(),
    pt_workout: Math.max(0, Math.round(num("pt_workout", 5))),
    pt_clean: Math.max(0, Math.round(num("pt_clean", 3))),
    pt_fast: Math.max(0, Math.round(num("pt_fast", 5))),
    pt_litre: Math.max(0, Math.round(num("pt_litre", 1))),
    bonus_cap: Math.max(0, Math.round(num("bonus_cap", 0))),
  }).eq("id", challengeId);
  revalidatePath(`/c/${challengeId}/owner`);
}

export async function regenerateInvite(challengeId: string) {
  const supabase = await assertOwner(challengeId);
  // 18 hex chars
  const token = Array.from({ length: 18 }, () => "0123456789abcdef"[Math.floor(cryptoRandom() * 16)]).join("");
  await supabase.from("challenges").update({ invite_token: token }).eq("id", challengeId);
  revalidatePath(`/c/${challengeId}/owner`);
}

function cryptoRandom() {
  // deterministic-safe randomness on the server
  const arr = new Uint32Array(1);
  (globalThis.crypto as Crypto).getRandomValues(arr);
  return arr[0] / 2 ** 32;
}

export async function removeMember(challengeId: string, userId: string) {
  const supabase = await assertOwner(challengeId);
  await supabase.from("memberships").delete()
    .eq("challenge_id", challengeId).eq("user_id", userId).eq("role", "member");
  revalidatePath(`/c/${challengeId}/owner`);
}

export async function postBonus(challengeId: string, formData: FormData) {
  const supabase = await assertOwner(challengeId);
  const week_no = parseInt((formData.get("week_no") as string) || "1", 10);
  const title = ((formData.get("title") as string) || "").trim();
  const points = parseInt((formData.get("points") as string) || "10", 10);
  if (!title) return;
  await supabase.from("bonus_challenges")
    .upsert({ challenge_id: challengeId, week_no, title, points }, { onConflict: "challenge_id,week_no" });
  revalidatePath(`/c/${challengeId}/owner`);
}

export async function deleteBonus(challengeId: string, bonusId: string) {
  const supabase = await assertOwner(challengeId);
  await supabase.from("bonus_challenges").delete().eq("id", bonusId);
  revalidatePath(`/c/${challengeId}/owner`);
}
