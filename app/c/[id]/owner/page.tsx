import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Challenge, Membership, BonusChallenge } from "@/lib/types";
import { updateSettings, postBonus } from "./actions";
import InviteBox from "./InviteBox";
import RosterRow from "./RosterRow";
import BonusRow from "./BonusRow";

export default async function OwnerPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: challenge } = await supabase.from("challenges").select("*").eq("id", params.id).single();
  const ch = challenge as Challenge;

  const { data: myMem } = await supabase
    .from("memberships").select("role").eq("challenge_id", params.id).eq("user_id", user!.id).maybeSingle();
  if (myMem?.role !== "owner") redirect(`/c/${params.id}`);

  const { data: members } = await supabase
    .from("memberships").select("user_id, role, profiles(display_name)").eq("challenge_id", params.id);
  const { data: bonuses } = await supabase
    .from("bonus_challenges").select("*").eq("challenge_id", params.id).order("week_no");

  const mem = (members ?? []) as unknown as Membership[];
  const bon = (bonuses ?? []) as BonusChallenge[];
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const inviteUrl = `${site}/join/${ch.invite_token}`;

  const save = updateSettings.bind(null, params.id);
  const addBonus = postBonus.bind(null, params.id);

  return (
    <main style={{ paddingTop: 4 }}>
      <h3 className="sec">Invite your team</h3>
      <div className="card" style={{ padding: 18 }}>
        <InviteBox challengeId={params.id} inviteUrl={inviteUrl} />
      </div>

      <h3 className="sec">Roster ({mem.length})</h3>
      <div className="card">
        {mem.map((m) => (
          <RosterRow
            key={m.user_id}
            challengeId={params.id}
            userId={m.user_id}
            name={(m as any).profiles?.display_name ?? "Member"}
            role={m.role}
          />
        ))}
      </div>

      <h3 className="sec">Challenge settings</h3>
      <div className="card" style={{ padding: 18 }}>
        <form action={save}>
          <label className="fld">Name</label>
          <input className="input" name="name" defaultValue={ch.name} />
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1.4 }}>
              <label className="fld">Start date</label>
              <input className="input" name="start_date" type="date" defaultValue={ch.start_date} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="fld">Weeks</label>
              <input className="input" name="weeks" type="number" min={1} defaultValue={ch.weeks} />
            </div>
          </div>
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
          <input className="input" name="timezone" defaultValue={ch.timezone || "Africa/Johannesburg"} placeholder="Africa/Johannesburg" />

          <h3 className="sec" style={{ marginBottom: 6 }}>Scoring</h3>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label className="fld">Workout</label><input className="input" name="pt_workout" type="number" min={0} defaultValue={ch.pt_workout} /></div>
            <div style={{ flex: 1 }}><label className="fld">Clean day</label><input className="input" name="pt_clean" type="number" min={0} defaultValue={ch.pt_clean} /></div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label className="fld">Full fast</label><input className="input" name="pt_fast" type="number" min={0} defaultValue={ch.pt_fast} /></div>
            <div style={{ flex: 1 }}><label className="fld">Per litre</label><input className="input" name="pt_litre" type="number" min={0} defaultValue={ch.pt_litre} /></div>
          </div>
          <label className="fld">Bonus workout cap <span className="dim">(extra scoring workouts/week beyond 5 — 0 = unlimited)</span></label>
          <input className="input" name="bonus_cap" type="number" min={0} defaultValue={ch.bonus_cap} />
          <button className="btn mt20" type="submit">Save settings</button>
          <p className="note">Scoring changes apply to entries logged <b>after</b> you save.</p>
        </form>
      </div>

      <h3 className="sec">Weekly bonus challenge</h3>
      <div className="card" style={{ padding: 18 }}>
        {bon.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {bon.map((b) => <BonusRow key={b.id} challengeId={params.id} bonus={b} />)}
          </div>
        )}
        <form action={addBonus}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 90 }}>
              <label className="fld">Week</label>
              <input className="input" name="week_no" type="number" min={1} max={ch.weeks} defaultValue={1} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="fld">Points</label>
              <input className="input" name="points" type="number" min={0} defaultValue={10} />
            </div>
          </div>
          <label className="fld">Challenge</label>
          <input className="input" name="title" placeholder="e.g. 10,000 steps every day" />
          <button className="btn ghost mt14" type="submit">Post bonus challenge</button>
          <p className="note">Posting for a week that already has one will replace it.</p>
        </form>
      </div>

      <form action="/auth/signout" method="post" style={{ marginTop: 20 }}>
        <button className="btn ghost" type="submit">Sign out</button>
      </form>
    </main>
  );
}
