import { createClient } from "@/lib/supabase/server";
import type { Challenge, Entry, Membership } from "@/lib/types";
import { leaderboard, nutritionStreak } from "@/lib/scoring";

export default async function LeaderboardPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: challenge } = await supabase
    .from("challenges").select("*").eq("id", params.id).single();
  const { data: members } = await supabase
    .from("memberships").select("user_id, role, profiles(id, display_name)").eq("challenge_id", params.id);
  const { data: entries } = await supabase
    .from("entries").select("*").eq("challenge_id", params.id);

  const ch = challenge as Challenge;
  const mem = (members ?? []) as unknown as Membership[];
  const ents = (entries ?? []) as Entry[];

  const scores = leaderboard(ents);
  const rows = mem
    .map((m) => {
      const userEntries = ents.filter((e) => e.user_id === m.user_id);
      return {
        user_id: m.user_id,
        name: (m as any).profiles?.display_name ?? "Member",
        role: m.role,
        points: scores.get(m.user_id) ?? 0,
        streak: nutritionStreak(userEntries),
        me: m.user_id === user?.id,
      };
    })
    .sort((a, b) => b.points - a.points);

  const pot = ch.buyin_amount * mem.length;
  const colors = ["#31d07a", "#4aa8ff", "#f2b04a", "#c98aff", "#f2645a", "#5ad1c9"];

  return (
    <>
      <div className="banner">
        <div className="row"><h2>The Pot</h2><span className="wk">Winner takes all</span></div>
        <div className="meta" style={{ marginTop: 8 }}>
          <span>{mem.length} player{mem.length !== 1 ? "s" : ""} · {ch.currency} {ch.buyin_amount.toLocaleString()} each</span>
          <b style={{ color: "var(--gold)", fontSize: 18 }}>{ch.currency} {pot.toLocaleString()}</b>
        </div>
        <div className="banner-sub">{ch.weeks} weeks · starts {ch.start_date} · most points wins</div>
      </div>

      <main>
        <h3 className="sec">Leaderboard</h3>
        <div className="card">
          {rows.length === 0 ? (
            <div className="empty">No members yet.</div>
          ) : rows.map((r, i) => {
            const rank = i + 1;
            const ci = mem.findIndex((m) => m.user_id === r.user_id) % colors.length;
            return (
              <div key={r.user_id} className={`lb-row${r.me ? " me" : ""}`}>
                <div className={`rank${rank <= 3 ? " g" + rank : ""}`}>{rank}</div>
                <div className="av" style={{ background: colors[ci] }}>{r.name[0]?.toUpperCase()}</div>
                <div className="lb-info">
                  <div className="nm">{r.name}{r.me && <span className="youtag">YOU</span>}{r.role === "owner" && <span className="ownertag">OWNER</span>}</div>
                  <div className="sub">{r.streak > 0 ? <span className="streak">🔥 {r.streak}d clean</span> : <span>—</span>}</div>
                </div>
                <div className="lb-score"><div className="pts">{r.points}</div><div className="of">pts</div></div>
              </div>
            );
          })}
        </div>
        <p className="note"><b>Nothing is mandatory</b> — do as much or as little as you like. Whoever has the most points when logging closes wins. OTC runs on the honour system — be honest.</p>
      </main>
    </>
  );
}
