import { createClient } from "@/lib/supabase/server";
import type { Challenge, Entry, Membership } from "@/lib/types";
import { leaderboard, breakdown, nutritionStreak, todayYMD, weekDaysYMD, weekNumberYMD } from "@/lib/scoring";

export default async function ProgressPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: challenge } = await supabase.from("challenges").select("*").eq("id", params.id).single();
  const { data: members } = await supabase.from("memberships").select("user_id, role").eq("challenge_id", params.id);
  const { data: allEntries } = await supabase.from("entries").select("*").eq("challenge_id", params.id);

  const ch = challenge as Challenge;
  const mem = (members ?? []) as Membership[];
  const ents = (allEntries ?? []) as Entry[];
  const mine = ents.filter((e) => e.user_id === user?.id);

  const scores = leaderboard(ents);
  const myTotal = scores.get(user!.id) ?? 0;
  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const leaderPts = sorted[0]?.[1] ?? 0;
  const rank = sorted.findIndex(([uid]) => uid === user?.id) + 1;
  const gap = leaderPts - myTotal;

  // this week's breakdown
  const tz = ch.timezone || "Africa/Johannesburg";
  const today = todayYMD(tz);
  const days = weekDaysYMD(today);
  const thisWeek = mine.filter((e) => e.day >= days[0] && e.day <= days[6]);
  const b = breakdown(thisWeek);
  // exercise rows store the session count in `detail`
  const sessionsLogged = mine
    .filter((e) => e.kind === "workout")
    .reduce((a, e) => a + Number(e.detail ?? 1), 0);
  const streak = nutritionStreak(mine);

  // points by week bars
  const byWeek: number[] = Array(ch.weeks).fill(0);
  for (const e of mine) {
    const wn = weekNumberYMD(ch.start_date, e.day);
    if (wn >= 1 && wn <= ch.weeks) byWeek[wn - 1] += e.points;
  }
  const curWeek = weekNumberYMD(ch.start_date, today);
  const wkMax = Math.max(60, ...byWeek);

  return (
    <>
      <div className="banner">
        <div className="row"><h2>Your progress</h2><span className="wk">{rank > 0 ? `Rank ${rank} of ${mem.length}` : "—"}</span></div>
        <div className="track"><div className="fill" style={{ width: `${leaderPts ? Math.min(100, (myTotal / leaderPts) * 100) : 0}%` }} /></div>
        <div className="meta"><span>Season total</span><span><b>{myTotal}</b> pts · leader {leaderPts}</span></div>
      </div>

      <main>
        <div className="stat-grid">
          <div className="stat"><div className="v brand">{myTotal}</div><div className="k">Total points</div></div>
          <div className="stat"><div className="v warn">{streak}<small> days</small></div><div className="k">Nutrition streak</div></div>
          <div className="stat"><div className="v accent">{sessionsLogged}</div><div className="k">Sessions logged</div></div>
          <div className="stat pot"><div className="v">{rank === 1 ? "Leader 👑" : `${gap} pts`}</div><div className="k">Behind the leader</div></div>
        </div>

        <h3 className="sec">Points by week</h3>
        <div className="card" style={{ padding: "6px 12px 14px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110, padding: "14px 4px 0" }}>
            {byWeek.map((v, i) => {
              const future = i + 1 > curWeek;
              const h = future ? 4 : Math.min(100, (v / wkMax) * 100);
              const cur = i + 1 === curWeek;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ width: "100%", background: "var(--surface2)", borderRadius: "5px 5px 0 0", height: "100%", position: "relative" }}>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${h}%`, borderRadius: "5px 5px 0 0", background: future ? "var(--line)" : "linear-gradient(180deg,var(--brand),var(--brand-dim))" }} />
                  </div>
                  <div style={{ fontSize: 9, color: cur ? "var(--brand)" : "var(--dim)", fontWeight: cur ? 700 : 400 }}>{i + 1}</div>
                </div>
              );
            })}
          </div>
        </div>

        <h3 className="sec">Point sources this week</h3>
        <div className="stat-grid">
          <div className="stat"><div className="v brand">{b.workout}</div><div className="k">🏃 Exercise</div></div>
          <div className="stat"><div className="v fast">{b.nutrition}</div><div className="k">🥗 Nutrition</div></div>
          <div className="stat"><div className="v accent">{b.hydration}</div><div className="k">💧 Hydration</div></div>
          <div className="stat"><div className="v" style={{ color: "var(--gold)" }}>{b.bonus}</div><div className="k">🎯 Weekly bonus</div></div>
          <div className="stat" style={{ gridColumn: "1 / -1" }}><div className="v">{b.total}</div><div className="k">Week total</div></div>
        </div>
      </main>
    </>
  );
}
