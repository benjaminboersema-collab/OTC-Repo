"use client";

import { useTransition } from "react";
import { removeMember } from "./actions";

const colors = ["#31d07a", "#4aa8ff", "#f2b04a", "#c98aff", "#f2645a", "#5ad1c9"];

export default function RosterRow({
  challengeId,
  userId,
  name,
  role,
}: {
  challengeId: string;
  userId: string;
  name: string;
  role: string;
}) {
  const [pending, start] = useTransition();
  const color = colors[Math.abs(hash(userId)) % colors.length];

  return (
    <div className="lb-row">
      <div className="av" style={{ background: color }}>{name[0]?.toUpperCase()}</div>
      <div className="lb-info">
        <div className="nm">{name}{role === "owner" && <span className="ownertag">OWNER</span>}</div>
        <div className="sub"><span>{role === "owner" ? "Organiser" : "Member"}</span></div>
      </div>
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
