"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TabBar({ id, isOwner }: { id: string; isOwner: boolean }) {
  const path = usePathname();
  const base = `/c/${id}`;
  const tabs = [
    { href: base, label: "Leaderboard", icon: "🏆", match: (p: string) => p === base },
    { href: `${base}/checkin`, label: "Check-in", icon: "✅", match: (p: string) => p.startsWith(`${base}/checkin`) },
    { href: `${base}/progress`, label: "Progress", icon: "📈", match: (p: string) => p.startsWith(`${base}/progress`) },
  ];
  if (isOwner) tabs.push({ href: `${base}/owner`, label: "Owner", icon: "⚙️", match: (p: string) => p.startsWith(`${base}/owner`) });

  return (
    <nav className="tabbar">
      <div className="inner">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`nav-btn${t.match(path) ? " active" : ""}`}>
            <span className="ni">{t.icon}</span>
            <span className="nl">{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
