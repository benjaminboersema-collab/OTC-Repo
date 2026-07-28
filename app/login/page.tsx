"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "register";

const PIN_LENGTH = 6;

function friendly(msg: string) {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and PIN don't match.";
  if (m.includes("already registered")) return "That email already has an account — switch to Sign in.";
  if (m.includes("password should be")) return `Your PIN must be ${PIN_LENGTH} digits.`;
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("unable to validate email")) return "That doesn't look like a valid email address.";
  if (!msg || msg === "{}") return "Something went wrong. Please try again.";
  return msg;
}

function LoginInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, PIN_LENGTH);

  function switchMode(m: Mode) {
    setMode(m);
    setErr("");
    setNote("");
    setPin("");
    setPin2("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setNote("");

    if (pin.length !== PIN_LENGTH) {
      setErr(`Your PIN must be ${PIN_LENGTH} digits.`);
      return;
    }
    if (mode === "register" && pin !== pin2) {
      setErr("The two PINs don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password: pin,
        options: { data: { display_name: name.trim() || email.split("@")[0] } },
      });
      setLoading(false);
      if (error) return setErr(friendly(error.message));
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
      setLoading(false);
      if (error) return setErr(friendly(error.message));
    }

    window.location.assign(next);
  }

  async function forgotPin() {
    setErr("");
    setNote("");
    if (!email) return setErr("Enter your email first, then tap 'Forgot PIN'.");
    setLoading(true);
    const supabase = createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setLoading(false);
    if (error) setErr(friendly(error.message));
    else setNote(`Sign-in link sent to ${email}. Open it, then you can set a new PIN.`);
  }

  return (
    <div className="center-page">
      <div className="logo" style={{ fontSize: 28, marginBottom: 6 }}>
        <span className="mark" style={{ width: 44, height: 44, fontSize: 20 }}>OTC</span>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px" }}>Our Team Challenge</h1>
      <p className="muted" style={{ fontSize: 14, marginTop: 6, maxWidth: 300 }}>
        Show up. Score points. Win the pot.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 20, width: "100%", maxWidth: 340 }}>
        <button
          type="button"
          className={mode === "signin" ? "btn" : "btn ghost"}
          style={{ flex: 1, marginTop: 0 }}
          onClick={() => switchMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === "register" ? "btn" : "btn ghost"}
          style={{ flex: 1, marginTop: 0 }}
          onClick={() => switchMode("register")}
        >
          Create account
        </button>
      </div>

      <form onSubmit={submit} style={{ width: "100%", maxWidth: 340, marginTop: 18 }}>
        {mode === "register" && (
          <>
            <label className="fld">Your name</label>
            <input
              className="input"
              type="text"
              placeholder="Ben"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </>
        )}

        <label className="fld">Email</label>
        <input
          className="input"
          type="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label className="fld">{mode === "register" ? `Choose a ${PIN_LENGTH}-digit PIN` : "Your PIN"}</label>
        <input
          className="input"
          type="password"
          inputMode="numeric"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          required
          placeholder="••••••"
          value={pin}
          onChange={(e) => setPin(digitsOnly(e.target.value))}
          style={{ letterSpacing: "8px", fontSize: 20, textAlign: "center" }}
        />

        {mode === "register" && (
          <>
            <label className="fld">Confirm PIN</label>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              required
              placeholder="••••••"
              value={pin2}
              onChange={(e) => setPin2(digitsOnly(e.target.value))}
              style={{ letterSpacing: "8px", fontSize: 20, textAlign: "center" }}
            />
          </>
        )}

        <button className="btn mt20" disabled={loading}>
          {loading ? "Please wait…" : mode === "register" ? "Create account →" : "Sign in →"}
        </button>

        {err && <p className="err">{err}</p>}
        {note && <p className="note">{note}</p>}

        {mode === "signin" && (
          <button type="button" className="btn ghost mt14" onClick={forgotPin} disabled={loading}>
            Forgot PIN — email me a link
          </button>
        )}

        <p className="note">
          {mode === "register"
            ? "Pick something you'll remember. You'll use this PIN every time you sign in."
            : "New here? Tap Create account above."}
        </p>
      </form>
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
