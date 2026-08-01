"use client";

import { useTransition } from "react";
import { removeMember, setCheerleader } from "./actions";

const colors = ["#31d07a", "#4aa8ff", "#f2b04a", "#c98aff", "#f2645a", "#5ad1c9"];

export default function RosterRow({
  challengeId,
  userId,
  name,
  role,
  cheerleader,
}: {
  challengeId: string;
  userId: string;
  name: string;
  role: string;
  cheerleader: boolean;
}) {
  const [pending, start] = useTransition();
  const color = colors[Math.abs(hash(userId)) % colors.length];

  const sub = cheerleader
    ? "Cheerleader · not competing"
    : role === "owner"
      ? "Organiser"
      : "Playing";

  return (
    <div className="lb-row">
      <div className={`av${cheerleader ? " cheer-av" : ""}`} style={cheerleader ? undefined : { background: color }}>
        {cheerleader ? "🎊" : name[0]?.toUpperCase()}
      </div>
      <div className="lb-info">
        <div className="nm">
          {name}
          {role === "owner" && <span className="ownertag">OWNER</span>}
          {cheerleader && <span className="cheertag">CHEER</span>}
        </div>
        <div className="sub"><span>{sub}</span></div>
      </div>

      <button
        className="chip"
        disabled={pending}
        title={cheerleader ? "Put them back in the running" : "They stay in the challenge but stop competing"}
        onClick={() => start(async () => { await setCheerleader(challengeId, userId, !cheerleader); })}
      >
        {pending ? "…" : cheerleader ? "Back to team" : "Cheerleader"}
      </button>

      {role === "member" && (
        <button
          className="chip"
          disabled={pending}
          onClick={() => { if (confirm(`Remove ${name} from the challenge?`)) start(async () => { await removeMember(challengeId, userId); }); }}
        >
          {pending ? "…" : "Remove"}
        </button>
      )}
    </div>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
