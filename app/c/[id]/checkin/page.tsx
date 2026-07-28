import { createClient } from "@/lib/supabase/server";
import type { Challenge, Entry } from "@/lib/types";
import { todayYMD, weekDaysYMD } from "@/lib/scoring";
import CheckinClient from "./CheckinClient";

export default async function CheckinPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: challenge } = await supabase
    .from("challenges").select("*").eq("id", params.id).single();
  const ch = challenge as Challenge;

  const tz = ch?.timezone || "Africa/Johannesburg";
  const today = todayYMD(tz);
  const days = weekDaysYMD(today);

  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .eq("challenge_id", params.id)
    .eq("user_id", user!.id)
    .gte("day", days[0])
    .lte("day", days[6]);

  return (
    <CheckinClient
      challenge={ch}
      weekDays={days}
      today={today}
      entries={(entries ?? []) as Entry[]}
    />
  );
}
