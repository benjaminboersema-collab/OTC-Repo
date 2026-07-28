"use client";

import { useState, useTransition } from "react";
import { regenerateInvite } from "./actions";

export default function InviteBox({ challengeId, inviteUrl }: { challengeId: string; inviteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: "Join our team challenge", url: inviteUrl }); } catch { /* cancelled */ }
    } else {
      copy();
    }
  }

  return (
    <div>
      <p className="note" style={{ marginTop: 0 }}>Anyone with this link can sign in and join. Share it in your WhatsApp group.</p>
      <div className="pill-copy">{inviteUrl || "Set NEXT_PUBLIC_SITE_URL to generate the full link"}</div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="btn sm" onClick={share} style={{ flex: 1 }}>{copied ? "Copied ✓" : "Share / copy link"}</button>
        <button
          className="btn ghost sm"
          disabled={pending}
          onClick={() => start(async () => { await regenerateInvite(challengeId); })}
        >
          {pending ? "…" : "Reset link"}
        </button>
      </div>
      <p className="note">Resetting makes the old link stop working — use it if a link leaks.</p>
    </div>
  );
}
