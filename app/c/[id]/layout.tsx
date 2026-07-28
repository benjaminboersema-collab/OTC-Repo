import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TabBar from "./TabBar";

export default async function ChallengeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/c/${params.id}`)}`);

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, challenges(name)")
    .eq("challenge_id", params.id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!membership) {
    return (
      <div className="center-page">
        <div style={{ fontSize: 34 }}>🚫</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginTop: 10 }}>Not a member</h1>
        <p className="muted mt8">You haven't joined this challenge. Open your invite link to join.</p>
        <Link href="/dashboard" className="btn ghost sm mt20">Go to dashboard</Link>
      </div>
    );
  }

  const isOwner = membership.role === "owner";
  const name = (membership as any).challenges?.name ?? "Our Team Challenge";

  return (
    <div className="shell">
      <header className="app-head">
        <div className="logo"><span className="mark">OTC</span>{name}</div>
        {isOwner && <Link href={`/c/${params.id}/owner`} className="chip owner">⚙ Owner</Link>}
      </header>
      {children}
      <TabBar id={params.id} isOwner={isOwner} />
    </div>
  );
}
