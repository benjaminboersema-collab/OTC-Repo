"use client";

import { useTransition } from "react";
import type { BonusChallenge } from "@/lib/types";
import { deleteBonus } from "./actions";

export default function BonusRow({ challengeId, bonus }: { challengeId: string; bonus: BonusChallenge }) {
  const [pending, start] = useTransition();
  return (
    <div className="row-between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Week {bonus.week_no} · <span style={{ color: "var(--brand)" }}>+{bonus.points}</span></div>
        <div className="dim" style={{ fontSize: 13 }}>{bonus.title}</div>
      </div>
      <button className="chip" disabled={pending} onClick={() => start(async () => { await deleteBonus(challengeId, bonus.id); })}>
        {pending ? "…" : "✕"}
      </button>
    </div>
  );
}
