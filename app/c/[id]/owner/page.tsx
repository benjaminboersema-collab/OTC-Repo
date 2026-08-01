import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Challenge, Membership, BonusChallenge, Entry } from "@/lib/types";
import { todayYMD, weekNumberYMD, endYMD, prettyTime } from "@/lib/scoring";
import { updateSettings, saveBonuses, saveAdjustments, deleteChallenge } from "./actions";
import InviteBox from "./InviteBox";
import RosterRow from "./RosterRow";
import ResetScores from "./ResetScores";

export const dynamic = "force-dynamic";

export default async function OwnerPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: challenge } = await supabase.from("challenges").select("*").eq("id", params.id).single();
  const ch = challenge as Challenge;

  const { data: myMem } = await supabase
    .from("memberships").select("role").eq("challenge_id", params.id).eq("user_id", user!.id).maybeSingle();
  if (myMem?.role !== "owner") redirect(`/c/${params.id}`);

  const [{ data: members }, { data: bonuses }, { data: entries }] = await Promise.all([
    supabase.from("memberships").select("user_id, role, cheerleader, profiles(display_name)").eq("challenge_id", params.id),
    supabase.from("bonus_challenges").select("*").eq("challenge_id", params.id).order("week_no"),
    supabase.from("entries").select("user_id, kind, points").eq("challenge_id", params.id),
  ]);

  const mem = (members ?? []) as unknown as Membership[];
  const playing = mem.filter((m) => !m.cheerleader);
  const cheer = mem.filter((m) => m.cheerleader);
  const bon = (bonuses ?? []) as BonusChallenge[];
  const byWeek = new Map(bon.map((b) => [b.week_no, b]));

  // earned = everything they logged themselves; adj = the owner's manual correction
  const ents = (entries ?? []) as Pick<Entry, "user_id" | "kind" | "points">[];
  const earned = new Map<string, number>();
  const adj = new Map<string, number>();
  for (const e of ents) {
    const bucket = e.kind === "adjustment" ? adj : earned;
    bucket.set(e.user_id, (bucket.get(e.user_id) ?? 0) + e.points);
  }

  const tz = ch.timezone || "Africa/Johannesburg";
  const curWeek = weekNumberYMD(ch.start_date, todayYMD(tz));
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const inviteUrl = `${site}/join/${ch.invite_token}`;

  const save = updateSettings.bind(null, params.id);
  const saveBonus = saveBonuses.bind(null, params.id);
  const saveAdj = saveAdjustments.bind(null, params.id);
  const removeChallenge = deleteChallenge.bind(null, params.id);

  return (
    <main style={{ paddingTop: 4 }}>
      <h3 className="sec">Invite your team</h3>
      <div className="card" style={{ padding: 18 }}>
        <InviteBox challengeId={params.id} inviteUrl={inviteUrl} />
      </div>

      <h3 className="sec">
        Roster ({playing.length} playing{cheer.length > 0 ? ` · ${cheer.length} cheering` : ""})
      </h3>
      <div className="card">
        {playing.map((m) => (
          <RosterRow
            key={m.user_id}
            challengeId={params.id}
            userId={m.user_id}
            name={(m as any).profiles?.display_name ?? "Member"}
            role={m.role}
            cheerleader={false}
          />
        ))}
      </div>

      <h3 className="sec">🎊 Cheerleading section 🎊</h3>
      <div className="card">
        {cheer.length === 0 ? (
          <div className="empty">
            Nobody is cheering. Tap <b>Cheerleader</b> on anyone above to move them here — they
            keep logging their own points, but they drop out of the ranks and the pot.
          </div>
        ) : cheer.map((m) => (
          <RosterRow
            key={m.user_id}
            challengeId={params.id}
            userId={m.user_id}
            name={(m as any).profiles?.display_name ?? "Member"}
            role={m.role}
            cheerleader={true}
          />
        ))}
      </div>

      {/* ---------- Manual point adjustments ---------- */}
      <h3 className="sec">Adjust points</h3>
      <form action={saveAdj}>
        <div className="card">
          {mem.map((m) => {
            const name = (m as any).profiles?.display_name ?? "Member";
            const e = earned.get(m.user_id) ?? 0;
            const a = adj.get(m.user_id) ?? 0;
            return (
              <div key={m.user_id} className="adjrow">
                <div className="lb-info">
                  <div className="nm">
                    {name}
                    {m.cheerleader && <span className="cheertag">CHEER</span>}
                  </div>
                  <div className="sub"><span>{e} logged · {e + a} total</span></div>
                </div>
                <input
                  className="input adjinput"
                  name={`adj_${m.user_id}`}
                  type="number"
                  step={1}
                  defaultValue={a}
                  aria-label={`Point adjustment for ${name}`}
                />
              </div>
            );
          })}
        </div>
        <button className="btn ghost mt14" type="submit">Save adjustments</button>
        <p className="note">
          Added on top of what the player logged themselves — use a minus sign to take points away.
          Set it back to <b>0</b> to clear the adjustment. Their own logs are never touched.
        </p>
      </form>

      {/* ---------- Weekly bonus challenge ---------- */}
      <h3 className="sec">Weekly bonus challenge</h3>
      <form action={saveBonus}>
        <div className="card">
          {Array.from({ length: ch.weeks }, (_, i) => {
            const w = i + 1;
            const b = byWeek.get(w);
            return (
              <div key={w} className={`wkrow${w === curWeek ? " cur" : ""}`}>
                <div className="wknum">{w}{w === curWeek && <small>NOW</small>}</div>
                <input
                  className="input desc"
                  name={`title_${w}`}
                  defaultValue={b?.title ?? ""}
                  placeholder="No challenge set"
                  maxLength={80}
                />
                <input
                  className="input pts"
                  name={`points_${w}`}
                  type="number"
                  min={0}
                  defaultValue={b?.points ?? 2}
                  aria-label={`Points for week ${w}`}
                />
              </div>
            );
          })}
        </div>
        <button className="btn mt14" type="submit">Save weekly challenges</button>
        <p className="note">
          Set a different challenge and point value for <b>every week</b> (e.g. &quot;10,000 steps a day&quot;).
          Leave a week blank for no bonus. Points are earned <b>per day</b> a player ticks it off, and the
          current week shows up on everyone&apos;s Check-in and Rules tabs.
        </p>
      </form>

      {/* ---------- Settings ---------- */}
      <h3 className="sec">Challenge settings</h3>
      <div className="card" style={{ padding: 18 }}>
        <form action={save}>
          <label className="fld">Name</label>
          <input className="input" name="name" defaultValue={ch.name} />

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="fld">Start date</label>
              <input className="input" name="start_date" type="date" defaultValue={ch.start_date} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="fld">End date</label>
              <input className="input" name="end_date" type="date" defaultValue={endYMD(ch)} />
            </div>
          </div>
          <label className="fld">Logging closes at <span className="dim">(a fixed cut-off avoids a midnight scramble)</span></label>
          <input className="input" name="end_time" type="time" defaultValue={prettyTime(ch.end_time)} />

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="fld">Buy-in</label>
              <input className="input" name="buyin" type="number" min={0} step={50} defaultValue={ch.buyin_amount} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="fld">Currency</label>
              <input className="input" name="currency" defaultValue={ch.currency} />
            </div>
          </div>
          <label className="fld">Timezone <span className="dim">(sets the daily / weekly cut-off for everyone)</span></label>
          <input className="input" name="timezone" defaultValue={tz} placeholder="Africa/Johannesburg" />

          <h3 className="sec" style={{ marginBottom: 6 }}>Scoring</h3>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label className="fld">Exercise session</label><input className="input" name="pt_workout" type="number" min={0} defaultValue={ch.pt_workout} /></div>
            <div style={{ flex: 1 }}><label className="fld">Clean day</label><input className="input" name="pt_clean" type="number" min={0} defaultValue={ch.pt_clean} /></div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label className="fld">Full fast</label><input className="input" name="pt_fast" type="number" min={0} defaultValue={ch.pt_fast} /></div>
            <div style={{ flex: 1 }}><label className="fld">Per litre</label><input className="input" name="pt_litre" type="number" min={0} defaultValue={ch.pt_litre} /></div>
          </div>

          <button className="btn mt20" type="submit">Save settings</button>
          <p className="note">
            These values drive the <b>Rules tab</b> — everyone sees the change straight away. Points already
            banked keep the value they were earned at.
          </p>
        </form>
      </div>

      {/* ---------- Danger zone ---------- */}
      <h3 className="sec">Reset</h3>
      <div className="card" style={{ padding: 18 }}>
        <ResetScores challengeId={params.id} />
      </div>

      <h3 className="sec" style={{ color: "#ff6b6b" }}>Danger zone</h3>
      <div className="card" style={{ padding: 18, border: "1px solid rgba(255,107,107,0.35)" }}>
        <p className="note" style={{ marginTop: 0 }}>
          Deleting <b>{ch.name}</b> permanently removes the challenge, its roster, every
          logged entry and all bonus challenges. This cannot be undone.
        </p>
        <form action={removeChallenge}>
          <label className="fld">Type <b>{ch.name}</b> to confirm</label>
          <input className="input" name="confirm_name" placeholder={ch.name} autoComplete="off" required />
          <button className="btn ghost mt14" type="submit" style={{ borderColor: "#ff6b6b", color: "#ff6b6b" }}>
            Delete this challenge
          </button>
        </form>
      </div>

      <form action="/auth/signout" method="post" style={{ marginTop: 20 }}>
        <button className="btn ghost" type="submit">Sign out</button>
      </form>
    </main>
  );
}
