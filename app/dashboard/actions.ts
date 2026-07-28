"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createChallenge(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim() || "Our Team Challenge";
  const start_date = (formData.get("start_date") as string) || new Date().toISOString().slice(0, 10);
  const weeks = parseInt((formData.get("weeks") as string) || "10", 10);
  const buyin_amount = parseFloat((formData.get("buyin") as string) || "0");

  const { data: challenge, error } = await supabase
    .from("challenges")
    .insert({ owner_id: user!.id, name, start_date, weeks, buyin_amount })
    .select("id")
    .single();

  if (error || !challenge) throw new Error(error?.message || "Could not create challenge");

  // owner joins their own challenge
  await supabase.from("memberships").insert({
    challenge_id: challenge.id,
    user_id: user!.id,
    role: "owner",
  });

  redirect(`/c/${challenge.id}`);
}
