"use client";

import { useTransition } from "react";
import { resetAllScores } from "./actions";

export default function ResetScores({ challengeId }: { challengeId: string }) {
  const [pending, start] = useTransition();

  return (
    <div>
      <p className="note" style={{ marginTop: 0 }}>
        Wipes <b>every logged entry</b> for everyone and puts the whole leaderboard back to zero. Members,
        the invite link and all your settings stay exactly as they are. Use it to clear test data before
        the challenge starts — it can&apos;t be undone.
      </p>
      <button
        className="btn ghost mt14"
        disabled={pending}
        style={{ color: "var(--danger)", borderColor: "rgba(242,100,90,.4)" }}
        onClick={() => {
          if (confirm("Reset ALL scores to zero for everyone? This cannot be undone.")) {
            start(async () => { await resetAllScores(challengeId); });
          }
        }}
      >
        {pending ? "Resetting…" : "Reset all scores to zero"}
      </button>
    </div>
  );
}
