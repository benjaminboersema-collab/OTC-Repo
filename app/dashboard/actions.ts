"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

export async function setDisplayName(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = ((formData.get("display_name") as string) || "").trim().replace(/\s+/g, " ");

  if (name.length < 2) throw new Error("Your name must be at least 2 characters.");
  if (name.length > 40) throw new Error("Your name must be 40 characters or fewer.");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  // keep the auth metadata in step with the profile row
  await supabase.auth.updateUser({ data: { display_name: name } });

  revalidatePath("/dashboard");
}

export async function setPin(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const pin = ((formData.get("pin") as string) || "").trim();
  const pin2 = ((formData.get("pin2") as string) || "").trim();

  if (!/^\d{6}$/.test(pin)) throw new Error("Your PIN must be exactly 6 digits.");
  if (pin !== pin2) throw new Error("The two PINs don't match.");

  const { error } = await supabase.auth.updateUser({ password: pin });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}
