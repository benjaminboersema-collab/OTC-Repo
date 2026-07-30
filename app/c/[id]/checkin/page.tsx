import { createClient } from "@/lib/supabase/server";
import type { Challenge, Entry, BonusChallenge } from "@/lib/types";
import { todayYMD, weekDaysYMD, weekNumberYMD, canLogDay, endYMD, prettyDate, prettyTime, isClosed } from "@/lib/scoring";
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
  const week = weekNumberYMD(ch.start_date, today);

  const [{ data: entries }, { data: bonus }] = await Promise.all([
    supabase.from("entries").select("*")
      .eq("challenge_id", params.id).eq("user_id", user!.id)
      .gte("day", days[0]).lte("day", days[6]),
    supabase.from("bonus_challenges").select("*")
      .eq("challenge_id", params.id).eq("week_no", week).maybeSingle(),
  ]);

  const lockedDays = days.filter((d) => !canLogDay(ch, d));
  const closed = isClosed(ch);
  const notice = closed
    ? `Logging closed at ${prettyTime(ch.end_time)} on ${prettyDate(endYMD(ch), false)}. Final scores are locked in.`
    : today < ch.start_date
      ? `The challenge starts on ${prettyDate(ch.start_date, false)} — days before that can't be logged.`
      : null;

  return (
    <CheckinClient
      challenge={ch}
      weekDays={days}
      today={today}
      weekNo={Math.max(1, week)}
      entries={(entries ?? []) as Entry[]}
      bonus={(bonus ?? null) as BonusChallenge | null}
      lockedDays={lockedDays}
      notice={notice}
    />
  );
}
