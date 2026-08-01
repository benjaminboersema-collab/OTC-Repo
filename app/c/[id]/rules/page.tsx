import { createClient } from "@/lib/supabase/server";
import type { Challenge, BonusChallenge } from "@/lib/types";
import { EX_MAX } from "@/lib/types";
import {
  todayYMD, weekNumberYMD, endYMD, totalWeeks, prettyDate, prettyTime,
} from "@/lib/scoring";

// Always fresh: the rules must reflect the owner's current settings.
export const dynamic = "force-dynamic";

export default async function RulesPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: challenge } = await supabase
    .from("challenges").select("*").eq("id", params.id).single();
  const ch = challenge as Challenge;

  const tz = ch.timezone || "Africa/Johannesburg";
  const today = todayYMD(tz);
  const week = weekNumberYMD(ch.start_date, today);
  const end = endYMD(ch);
  const close = prettyTime(ch.end_time);
  const weeks = totalWeeks(ch);

  const { data: bonus } = await supabase
    .from("bonus_challenges").select("*")
    .eq("challenge_id", params.id).eq("week_no", week).maybeSingle();
  const b = bonus as BonusChallenge | null;

  return (
    <>
      <div className="banner">
        <div className="row"><h2>The Rules</h2><span className="wk">{weeks} weeks</span></div>
        <div className="banner-sub">
          Score points every day. Highest total at {close} on {prettyDate(end, false)} takes the pot.
        </div>
      </div>

      <main>
        <h3 className="sec">The idea</h3>
        <div className="card" style={{ padding: "15px 18px" }}>
          <p className="note" style={{ marginTop: 0 }}>
            <b>Nothing is mandatory.</b> You don&apos;t have to work out, eat clean, fast, drink water or
            anything else on any given day. The winner is simply whoever collects the most points by the
            end — so do whatever earns you the most.
          </p>
          <p className="note">
            <b>Cheerleading section 📣</b> Not everyone has to race. The organiser can move anyone
            into the cheerleading section: you still log your own points and keep your streaks, but
            you sit outside the ranks and outside the pot. You can be moved back at any time.
          </p>
        </div>

        <h3 className="sec">Challenge dates</h3>
        <div className="card">
          <div className="rule">
            <div className="rico" style={{ background: "rgba(49,208,122,.15)" }}>🚦</div>
            <div className="rinfo"><div className="rt">Starts</div><div className="rd">Week 1, Day 1</div></div>
            <div className="rp" style={{ fontSize: 14, color: "var(--text)" }}>
              {prettyDate(ch.start_date, false)}<span>{ch.start_date.slice(0, 4)}</span>
            </div>
          </div>
          <div className="rule">
            <div className="rico" style={{ background: "rgba(255,207,77,.15)" }}>🏁</div>
            <div className="rinfo"><div className="rt">Ends</div><div className="rd">Logging closes — highest score wins</div></div>
            <div className="rp" style={{ fontSize: 14, color: "var(--gold)" }}>
              {prettyDate(end, false)}<span>{close}</span>
            </div>
          </div>
        </div>
        <p className="note">
          Logging closes at <b>{close} on {prettyDate(end, false)}</b> — a fixed cut-off so there&apos;s no
          last-minute midnight scramble. Times are {tz.replace("_", " ")}. Dates and the closing time are
          set by the organiser on the Owner page.
        </p>

        <h3 className="sec">How points work</h3>
        <div className="card">
          <div className="rule">
            <div className="rico" style={{ background: "rgba(49,208,122,.15)" }}>🏃</div>
            <div className="rinfo"><div className="rt">Exercise</div><div className="rd">Any exercise, 45 min+ · up to {EX_MAX} sessions a day</div></div>
            <div className="rp">{ch.pt_workout}<span>per session</span></div>
          </div>
          <div className="rule">
            <div className="rico" style={{ background: "rgba(49,208,122,.15)" }}>🥗</div>
            <div className="rinfo"><div className="rt">Clean eating day</div><div className="rd">A full day of clean, whole-food eating</div></div>
            <div className="rp">{ch.pt_clean}<span>pts / day</span></div>
          </div>
          <div className="rule">
            <div className="rico" style={{ background: "rgba(201,138,255,.15)" }}>⏳</div>
            <div className="rinfo"><div className="rt">Full-day fast</div><div className="rd">A complete 24-hour fast (instead of a clean day)</div></div>
            <div className="rp fast">{ch.pt_fast}<span>pts / day</span></div>
          </div>
          <div className="rule">
            <div className="rico" style={{ background: "rgba(74,168,255,.15)" }}>💧</div>
            <div className="rinfo"><div className="rt">Hydration</div><div className="rd">Every litre of water you log counts</div></div>
            <div className="rp accent">{ch.pt_litre}<span>pt / litre</span></div>
          </div>
          <div className="rule">
            <div className="rico" style={{ background: "rgba(255,207,77,.15)" }}>🎯</div>
            <div className="rinfo">
              <div className="rt">Weekly bonus</div>
              <div className="rd">{b?.title ? `This week: ${b.title}` : "A new challenge each week, set by the organiser"}</div>
            </div>
            <div className="rp" style={{ color: "var(--gold)" }}>
              {b?.title ? <>＋{b.points}<span>per day</span></> : <>＋<span>varies</span></>}
            </div>
          </div>
        </div>
        <p className="note">
          Exercise caps at <b>{EX_MAX} sessions a day</b> ({EX_MAX * ch.pt_workout} pts). Everything here is
          optional — you&apos;re just chasing the highest total by {prettyDate(end, false)}.
        </p>

        <h3 className="sec">What counts</h3>
        <div className="card">
          <div className="def">
            <div className="dt"><span>🥗</span> Clean eating day <span className="pill">{ch.pt_clean} pts</span></div>
            <p>
              A clean day means <b>no alcohol, no sugar, no processed foods</b> — only healthy, whole foods.
              Slip on any one of these and the day doesn&apos;t score.
            </p>
            <div className="chips">
              <span className="ychip">✓ Meat, eggs, fish</span>
              <span className="ychip">✓ Fruit &amp; veg</span>
              <span className="ychip">✓ Rice, oats, potatoes</span>
              <span className="ychip">✓ Nuts, beans</span>
            </div>
            <div className="chips">
              <span className="xchip">✕ Alcohol</span>
              <span className="xchip">✕ Sugar &amp; sweets</span>
              <span className="xchip">✕ Processed foods</span>
              <span className="xchip">✕ Fast food</span>
            </div>
          </div>
          <div className="def">
            <div className="dt"><span>⏳</span> Full-day fast <span className="pill fast">{ch.pt_fast} pts</span></div>
            <p>
              Only a <b>full 24-hour fast</b> qualifies — nothing shorter counts. It replaces the
              clean-eating points for that day, and is worth more because it&apos;s harder.
            </p>
          </div>
          <div className="def">
            <div className="dt"><span>💧</span> Hydration <span className="pill accent">{ch.pt_litre} pt / L</span></div>
            <p>Log each litre of water you drink — <b>{ch.pt_litre} point per litre</b>, with no daily cap.</p>
          </div>
          <div className="def">
            <div className="dt"><span>🎯</span> Weekly bonus <span className="pill">{b?.points ?? "—"} pts</span></div>
            <p>
              {b?.title
                ? <>This week the organiser has set <b>{b.title}</b> — tick off each day you manage it to earn <b>{b.points} points a day</b>.</>
                : <>The organiser can set a different challenge each week (like 10,000 steps a day). Tick off each day you hit it to earn the bonus.</>}
            </p>
          </div>
        </div>

        <h3 className="sec">Accountability</h3>
        <div className="card" style={{ padding: "16px 18px" }}>
          <p className="note" style={{ marginTop: 0 }}>
            OTC runs on the <b>honour system</b> — you don&apos;t need a photo to log anything. Share a watch
            screenshot, Strava, or a gym selfie in the group if you want to keep each other fired up, but
            it&apos;s down to trust: be honest. It&apos;s about discipline, not perfection.
          </p>
        </div>
      </main>
    </>
  );
}
