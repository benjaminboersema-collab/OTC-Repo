"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function joinChallenge(token: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);

  const { data: cid, error } = await supabase.rpc("join_by_invite", { token });
  if (error || !cid) throw new Error(error?.message || "Invalid invite link");
  redirect(`/c/${cid}`);
}
