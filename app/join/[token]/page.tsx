import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { joinChallenge } from "./actions";

export default async function JoinPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Look up the challenge by invite token (works even before the user is a member)
  const { data, error } = await supabase.rpc("challenge_by_invite", { token: params.token });
  const challenge = Array.isArray(data) ? data[0] : data;

  if (error || !challenge) {
    return (
      <div className="center-page">
        <div style={{ fontSize: 36 }}>🔗</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginTop: 10 }}>Invite not found</h1>
        <p className="muted mt8">This invite link is invalid or has been reset. Ask your organiser for a fresh one.</p>
        <Link href="/dashboard" className="btn ghost sm mt20">Go to dashboard</Link>
      </div>
    );
  }

  const join = joinChallenge.bind(null, params.token);

  return (
    <div className="center-page">
      <div className="logo" style={{ marginBottom: 8 }}><span className="mark" style={{ width: 44, height: 44 }}>OTC</span></div>
      <p className="muted" style={{ fontSize: 13 }}>You've been invited to join</p>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 4, letterSpacing: "-.5px" }}>{challenge.name}</h1>
      <p className="muted mt8">
        {challenge.weeks} weeks · starts {challenge.start_date} · {challenge.member_count} member{Number(challenge.member_count) !== 1 ? "s" : ""} so far
      </p>

      {user ? (
        <form action={join} style={{ width: "100%", maxWidth: 320, marginTop: 22 }}>
          <button className="btn" type="submit">Join the challenge →</button>
        </form>
      ) : (
        <Link
          href={`/login?next=${encodeURIComponent(`/join/${params.token}`)}`}
          className="btn"
          style={{ maxWidth: 320, marginTop: 22 }}
        >
          Sign in to join →
        </Link>
      )}
      <p className="note" style={{ maxWidth: 320 }}>
        Signing in creates your account with a one-tap email link — no password to remember.
      </p>
    </div>
  );
}
