import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createChallenge, setPin } from "./actions";

export default async function Dashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("role, challenges(id, name, start_date, weeks)")
    .order("joined_at", { ascending: false });

  const rows = (memberships ?? []) as any[];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="shell">
      <header className="app-head">
        <div className="logo"><span className="mark">OTC</span>Our Team Challenge</div>
        <form action="/auth/signout" method="post">
          <button className="chip" type="submit">Sign out</button>
        </form>
      </header>

      <main>
        <h3 className="sec">Your challenges</h3>
        {rows.length === 0 ? (
          <div className="card"><div className="empty">You're not in a challenge yet. Create one below, or open an invite link from your organiser.</div></div>
        ) : (
          <div className="card">
            {rows.map((r) => (
              <Link key={r.challenges.id} href={`/c/${r.challenges.id}`} className="lb-row">
                <div className="av" style={{ background: "var(--brand)" }}>{r.challenges.name[0]}</div>
                <div className="lb-info">
                  <div className="nm">{r.challenges.name}{r.role === "owner" && <span className="ownertag">OWNER</span>}</div>
                  <div className="sub"><span>{r.challenges.weeks} weeks · starts {r.challenges.start_date}</span></div>
                </div>
                <div className="lb-score"><div className="of">open →</div></div>
              </Link>
            ))}
          </div>
        )}

        <h3 className="sec">Start a new challenge</h3>
        <div className="card" style={{ padding: 18 }}>
          <form action={createChallenge}>
            <label className="fld">Challenge name</label>
            <input className="input" name="name" defaultValue="Our Team Challenge" required />
            <label className="fld">Start date</label>
            <input className="input" name="start_date" type="date" defaultValue={today} required />
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="fld">Weeks</label>
                <input className="input" name="weeks" type="number" min={1} max={52} defaultValue={10} required />
              </div>
              <div style={{ flex: 1 }}>
                <label className="fld">Buy-in (R)</label>
                <input className="input" name="buyin" type="number" min={0} step={50} defaultValue={750} />
              </div>
            </div>
            <button className="btn mt20" type="submit">Create challenge →</button>
            <p className="note">You'll become the owner and get an invite link to send your team.</p>
          </form>
        </div>
        <h3 className="sec">Your PIN</h3>
        <div className="card" style={{ padding: 18 }}>
          <form action={setPin}>
            <p className="note" style={{ marginTop: 0 }}>
              Set or change the 6-digit PIN you use to sign in.
            </p>
            <label className="fld">New PIN</label>
            <input className="input" name="pin" type="password" inputMode="numeric"
              maxLength={6} required placeholder="••••••" autoComplete="new-password"
              style={{ letterSpacing: "8px", fontSize: 20, textAlign: "center" }} />
            <label className="fld">Confirm PIN</label>
            <input className="input" name="pin2" type="password" inputMode="numeric"
              maxLength={6} required placeholder="••••••" autoComplete="new-password"
              style={{ letterSpacing: "8px", fontSize: 20, textAlign: "center" }} />
            <button className="btn ghost mt14" type="submit">Save PIN</button>
          </form>
        </div>
      </main>
    </div>
  );
}
