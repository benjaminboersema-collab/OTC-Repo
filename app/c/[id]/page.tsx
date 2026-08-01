import { createClient } from "@/lib/supabase/server";
import type { Challenge, Entry, Membership } from "@/lib/types";
import { leaderboard, nutritionStreak, endYMD, todayYMD } from "@/lib/scoring";
import PlayerPeek, { type PeekEntry } from "./PlayerPeek";

export default async function LeaderboardPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: challenge } = await supabase
    .from("challenges").select("*").eq("id", params.id).single();
  const { data: members } = await supabase
    .from("memberships").select("user_id, role, cheerleader, profiles(id, display_name)").eq("challenge_id", params.id);
  const { data: entries } = await supabase
    .from("entries").select("*").eq("challenge_id", params.id);

  const ch = challenge as Challenge;
  const mem = (members ?? []) as unknown as Membership[];
  const ents = (entries ?? []) as Entry[];

  const scores = leaderboard(ents);
  const colors = ["#31d07a", "#4aa8ff", "#f2b04a", "#c98aff", "#f2645a", "#5ad1c9"];

  const tz = ch.timezone || "Africa/Johannesburg";
  const today = todayYMD(tz);
  const end = endYMD(ch);

  const toRow = (m: Membership) => {
    const userEntries = ents.filter((e) => e.user_id === m.user_id);
    return {
      user_id: m.user_id,
      name: (m as any).profiles?.display_name ?? "Member",
      role: m.role,
      points: scores.get(m.user_id) ?? 0,
      streak: nutritionStreak(userEntries),
      me: m.user_id === user?.id,
      ci: Math.max(0, mem.findIndex((x) => x.user_id === m.user_id)) % colors.length,
      // only what the popup needs — keeps the client payload small
      peek: userEntries.map((e): PeekEntry => ({ day: e.day, kind: e.kind, detail: e.detail, points: e.points })),
    };
  };

  const byPoints = (a: { points: number }, b: { points: number }) => b.points - a.points;
  const rows = mem.filter((m) => !m.cheerleader).map(toRow).sort(byPoints);
  const cheerRows = mem.filter((m) => m.cheerleader).map(toRow).sort(byPoints);

  // cheerleaders neither pay in nor play for the pot
  const pot = ch.buyin_amount * rows.length;

  const nameBlock = (r: ReturnType<typeof toRow>) => (
    <PlayerPeek name={r.name} entries={r.peek} startDate={ch.start_date} endDate={end} today={today}>
      <span className="nm">
        {r.name}
        {r.me && <span className="youtag">YOU</span>}
        {r.role === "owner" && <span className="ownertag">OWNER</span>}
      </span>
    </PlayerPeek>
  );

  return (
    <>
      <div className="banner">
        <div className="row"><h2>The Pot</h2><span className="wk">Winner takes all</span></div>
        <div className="meta" style={{ marginTop: 8 }}>
          <span>{rows.length} player{rows.length !== 1 ? "s" : ""} · {ch.currency} {ch.buyin_amount.toLocaleString()} each</span>
          <b style={{ color: "var(--gold)", fontSize: 18 }}>{ch.currency} {pot.toLocaleString()}</b>
        </div>
        <div className="banner-sub">
          {ch.weeks} weeks · starts {ch.start_date} · most points wins
          {cheerRows.length > 0 && ` · ${cheerRows.length} cheering 🎊`}
        </div>
      </div>

      <main>
        <h3 className="sec">Leaderboard</h3>
        <div className="card">
          {rows.length === 0 ? (
            <div className="empty">No players yet.</div>
          ) : rows.map((r, i) => {
            const rank = i + 1;
            return (
              <div key={r.user_id} className={`lb-row${r.me ? " me" : ""}`}>
                <div className={`rank${rank <= 3 ? " g" + rank : ""}`}>{rank}</div>
                <div className="av" style={{ background: colors[r.ci] }}>{r.name[0]?.toUpperCase()}</div>
                <div className="lb-info">
                  {nameBlock(r)}
                  <div className="sub">{r.streak > 0 ? <span className="streak">🔥 {r.streak}d clean</span> : <span>—</span>}</div>
                </div>
                <div className="lb-score"><div className="pts">{r.points}</div><div className="of">pts</div></div>
              </div>
            );
          })}
        </div>
        <p className="note">Tap a name to see what they logged on any given day.</p>

        {cheerRows.length > 0 && (
          <>
            <h3 className="sec cheer-sec">🎊 Cheerleading section 🎊</h3>
            <div className="card cheer">
              {cheerRows.map((r) => (
                <div key={r.user_id} className={`lb-row cheer-row${r.me ? " me" : ""}`}>
                  <div className="rank cheer-rank">🎊</div>
                  <div className="av cheer-av">{r.name[0]?.toUpperCase()}</div>
                  <div className="lb-info">
                    {nameBlock(r)}
                    <div className="sub">{r.streak > 0 ? <span className="streak">🔥 {r.streak}d clean</span> : <span>—</span>}</div>
                  </div>
                  <div className="lb-score"><div className="pts">{r.points}</div><div className="of">pts</div></div>
                </div>
              ))}
            </div>
            <p className="note">
              Cheerleaders are part of the team but not the contest — they log their own points and
              keep their streaks, they just don&apos;t take a rank and don&apos;t play for the pot.
            </p>
          </>
        )}

        <p className="note"><b>Nothing is mandatory</b> — do as much or as little as you like. Whoever has the most points when logging closes wins. OTC runs on the honour system — be honest.</p>
      </main>
    </>
  );
}
