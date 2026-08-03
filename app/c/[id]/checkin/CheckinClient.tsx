"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { EX_MAX, type Challenge, type Entry, type NutritionState, type BonusChallenge } from "@/lib/types";
import { prettyDate } from "@/lib/scoring";
import { setWorkouts, setNutrition, setHydration, setBonus } from "./actions";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

export default function CheckinClient({
  challenge,
  weekDays,
  today,
  weekNo,
  currentWeek,
  totalWeeks,
  entries,
  bonus,
  lockedDays,
  notice,
}: {
  challenge: Challenge;
  weekDays: string[];
  today: string;
  weekNo: number;
  currentWeek: number;
  totalWeeks: number;
  entries: Entry[];
  bonus: BonusChallenge | null;
  lockedDays: string[];
  notice: string | null;
}) {
  const [pending, start] = useTransition();
  const [toast, setToast] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  const isCurrent = weekNo === currentWeek;
  const isPast = weekNo < currentWeek;
  const href = (w: number) => `/c/${challenge.id}/checkin?w=${w}`;

  const pop = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1400); };
  const locked = (d: string) => lockedDays.includes(d);
  const lockCls = (d: string) => (locked(d) ? " locked" : "");
  const toggleInfo = (k: string) => setInfo(info === k ? null : k);

  const find = (kind: string, d: string) => entries.find((e) => e.kind === kind && e.day === d);
  const exOn = (d: string) => Number(find("workout", d)?.detail ?? 0);
  const nutOn = (d: string) => find("nutrition", d)?.detail as NutritionState | undefined;
  const hydOn = (d: string) => Number(find("hydration", d)?.detail ?? 0);
  const bonOn = (d: string) => !!find("bonus", d);

  const sum = (kind: string) => entries.filter((e) => e.kind === kind).reduce((a, e) => a + e.points, 0);
  const exPts = sum("workout"), nutPts = sum("nutrition"), hydPts = sum("hydration"), bonPts = sum("bonus");
  const sessions = weekDays.reduce((a, d) => a + exOn(d), 0);
  const litres = weekDays.reduce((a, d) => a + hydOn(d), 0);
  const weekPts = exPts + nutPts + hydPts + bonPts;

  const cycleEx = (d: string) => {
    if (locked(d)) return;
    const next = (exOn(d) + 1) % (EX_MAX + 1);
    start(async () => {
      await setWorkouts(challenge.id, d, next);
      if (next > 0) pop(`${next} session${next > 1 ? "s" : ""} · +${next * challenge.pt_workout} 💪`);
    });
  };
  const cycleNut = (d: string) => {
    if (locked(d)) return;
    const cur = nutOn(d);
    const next: NutritionState | null = cur === undefined ? "clean" : cur === "clean" ? "fast" : null;
    start(async () => {
      await setNutrition(challenge.id, d, next);
      if (next === "clean") pop(`Clean day +${challenge.pt_clean} ✓`);
      else if (next === "fast") pop(`Full fast +${challenge.pt_fast} ⏳`);
    });
  };
  const bumpHyd = (d: string) => {
    if (locked(d)) return;
    const next = (hydOn(d) + 1) % 6;
    start(async () => { await setHydration(challenge.id, d, next); if (next > 0) pop(`${next} L 💧`); });
  };
  const tickBonus = (d: string) => {
    if (locked(d)) return;
    const next = !bonOn(d);
    start(async () => { await setBonus(challenge.id, d, next); if (next) pop(`Bonus +${bonus?.points ?? 0} 🎯`); });
  };

  return (
    <>
      <div className="banner">
        <div className="row">
          <h2>{isCurrent ? "This Week" : `Week ${weekNo}`}</h2>
          <span className="wk">{weekPts} pts</span>
        </div>
        <div className="track"><div className="fill" style={{ width: `${Math.min(100, (weekPts / 80) * 100)}%` }} /></div>
        <div className="meta">
          <span>{sessions} session{sessions !== 1 ? "s" : ""} · {nutPts} food · {litres}L · +{bonPts} bonus</span>
          <span>{pending ? "saving…" : "live"}</span>
        </div>
      </div>

      <main>
        {notice && (
          <div className="card" style={{ padding: "13px 16px", marginBottom: 12, borderColor: "rgba(242,176,74,.35)" }}>
            <p className="note" style={{ marginTop: 0, color: "var(--warn)" }}>{notice}</p>
          </div>
        )}
        <nav className="wknav" aria-label="Challenge week">
          {weekNo > 1
            ? <Link className="chip" href={href(weekNo - 1)} scroll={false}>◀ Week {weekNo - 1}</Link>
            : <span className="chip disabled">◀ Week {weekNo - 1}</span>}
          <Link
            className={`chip${isCurrent ? " disabled" : " now"}`}
            href={href(currentWeek)}
            scroll={false}
            aria-current={isCurrent ? "page" : undefined}
          >
            {isCurrent ? `Week ${weekNo} of ${totalWeeks}` : "Back to this week"}
          </Link>
          {weekNo < totalWeeks
            ? <Link className="chip" href={href(weekNo + 1)} scroll={false}>Week {weekNo + 1} ▶</Link>
            : <span className="chip disabled">Week {weekNo + 1} ▶</span>}
        </nav>

        <div className="card">
          <div className="checkin-head">
            <div className="title">
              Week {weekNo} check-in
              {isPast && <span className="pasttag">CATCHING UP</span>}
            </div>
            <div className="date">
              {isPast
                ? `${prettyDate(weekDays[0], false)} – ${prettyDate(weekDays[6], false)} · fill in anything you forgot.`
                : "Nothing's required — log whatever you do, it all adds points."}
            </div>
          </div>

          {/* Exercise */}
          <div className="cat">
            <div className="cat-top">
              <span className="lbl"><span className="ico">🏃</span>Exercise
                <button className="qbtn" onClick={() => toggleInfo("ex")} aria-label="Exercise rules">?</button>
              </span>
              <span className="cnt"><b>{exPts}</b> pts</span>
            </div>
            <div className="days">
              {weekDays.map((d, i) => {
                const n = exOn(d);
                return (
                  <div key={d} className={`day${n > 0 ? " exon" : ""}${d === today ? " today-outline" : ""}${lockCls(d)}`} onClick={() => cycleEx(d)}>
                    <span className="dn">{DOW[i]}</span><span className="dc">🏃</span>
                    <span className="dp">{n > 0 ? `+${n * challenge.pt_workout}` : ""}</span>
                  </div>
                );
              })}
            </div>
            <div className={`ruleinfo${info === "ex" ? " show" : ""}`}>
              Any exercise, 45 minutes or more. Tap a day to add a session:{" "}
              <b>1 = +{challenge.pt_workout}, 2 = +{challenge.pt_workout * 2}, 3 = +{challenge.pt_workout * 3}</b>.
              Max {EX_MAX} a day — a 4th tap clears it.
            </div>
            <p className="note"><b>{challenge.pt_workout} points per session, up to {EX_MAX} a day.</b></p>
          </div>

          {/* Nutrition */}
          <div className="cat">
            <div className="cat-top">
              <span className="lbl"><span className="ico">🥗</span>Nutrition
                <button className="qbtn" onClick={() => toggleInfo("nut")} aria-label="Nutrition rules">?</button>
              </span>
              <span className="cnt"><b>{nutPts}</b> pts</span>
            </div>
            <div className="days">
              {weekDays.map((d, i) => {
                const s = nutOn(d);
                const cls = s === "fast" ? "fast" : s === "clean" ? "clean" : "";
                const p = s === "fast" ? challenge.pt_fast : s === "clean" ? challenge.pt_clean : 0;
                return (
                  <div key={d} className={`day ${cls}${d === today ? " today-outline" : ""}${lockCls(d)}`} onClick={() => cycleNut(d)}>
                    <span className="dn">{DOW[i]}</span>
                    <span className="dc">{s === "fast" ? "⏳" : "🥗"}</span>
                    <span className="dp">{p ? `+${p}` : ""}</span>
                  </div>
                );
              })}
            </div>
            <div className="legend">
              <span><span className="sw clean" />Clean · {challenge.pt_clean}</span>
              <span><span className="sw fast" />Full fast · {challenge.pt_fast}</span>
            </div>
            <div className={`ruleinfo${info === "nut" ? " show" : ""}`}>
              <b>Clean day:</b> no alcohol, no sugar, no processed foods — only healthy whole foods.{" "}
              <b>Full-day fast:</b> a complete 24-hour fast only, nothing shorter counts.
            </div>
            <p className="note">Tap a day to cycle: <b>off → clean ({challenge.pt_clean}) → fasted ({challenge.pt_fast})</b>.</p>
          </div>

          {/* Hydration */}
          <div className="cat">
            <div className="cat-top">
              <span className="lbl"><span className="ico">💧</span>Hydration <span style={{ color: "var(--accent)", fontSize: 12 }}>· {challenge.pt_litre} pt / litre</span></span>
              <span className="cnt"><b>{hydPts}</b> pts</span>
            </div>
            <div className="hyd">
              {weekDays.map((d, i) => {
                const l = hydOn(d);
                return (
                  <div key={d} className={`hcell${l > 0 ? " on" : ""}${d === today ? " today-outline" : ""}${lockCls(d)}`} onClick={() => bumpHyd(d)}>
                    <span className="dn">{DOW[i]}</span><span className="hv">{l}</span><span className="hu">L</span>
                  </div>
                );
              })}
            </div>
            <p className="note">Tap a day to add a litre (cycles 0–5). <b>{challenge.pt_litre} point per litre</b>, no cap.</p>
          </div>

          {/* Weekly bonus */}
          <div className="cat">
            <div className="cat-top">
              <span className="lbl"><span className="ico">🎯</span>Weekly bonus
                {bonus?.title && <span style={{ color: "var(--gold)", fontSize: 12 }}>· +{bonus.points} / day</span>}
              </span>
              <span className="cnt"><b>{bonPts}</b> pts</span>
            </div>
            {bonus?.title ? (
              <>
                <div className="days">
                  {weekDays.map((d, i) => {
                    const on = bonOn(d);
                    return (
                      <div key={d} className={`day${on ? " bon" : ""}${d === today ? " today-outline" : ""}${lockCls(d)}`} onClick={() => tickBonus(d)}>
                        <span className="dn">{DOW[i]}</span><span className="dc">🎯</span>
                        <span className="dp">{on ? `+${bonus.points}` : ""}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="note">
                  <b>{isCurrent ? "This week" : `Week ${weekNo}`}: {bonus.title}</b> — tap each day you hit it. Set by the organiser.
                </p>
              </>
            ) : (
              <p className="note" style={{ marginTop: 0 }}>
                <b>No bonus challenge {isCurrent ? "this week" : `for week ${weekNo}`}.</b> The organiser can add one from the Owner tab.
              </p>
            )}
          </div>
        </div>
        <p className="note" style={{ textAlign: "center" }}>
          Highlighted cell = today. Tap any day to edit it — you can go back to earlier weeks
          and fill in anything you forgot, right up to the closing time. Days that haven&apos;t
          happened yet are greyed out.
        </p>
      </main>

      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>
    </>
  );
}
