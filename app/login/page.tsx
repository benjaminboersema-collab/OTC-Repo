"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const supabase = createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="center-page">
      <div className="logo" style={{ fontSize: 28, marginBottom: 6 }}>
        <span className="mark" style={{ width: 44, height: 44, fontSize: 20 }}>OTC</span>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px" }}>Our Team Challenge</h1>
      <p className="muted" style={{ fontSize: 14, marginTop: 6, maxWidth: 300 }}>
        Show up. Score points. Win the pot. Sign in with your email — no password needed.
      </p>

      {sent ? (
        <div className="card mt20" style={{ padding: 24, maxWidth: 340 }}>
          <div style={{ fontSize: 32 }}>📬</div>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>Check your email</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            We sent a magic sign-in link to <b style={{ color: "var(--text)" }}>{email}</b>. Tap it to log in.
          </p>
        </div>
      ) : (
        <form onSubmit={send} style={{ width: "100%", maxWidth: 340, marginTop: 22 }}>
          <input
            className="input"
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginTop: 0 }}
          />
          <button className="btn mt14" disabled={loading}>
            {loading ? "Sending…" : "Send magic link"}
          </button>
          {err && <p className="err">{err}</p>}
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
