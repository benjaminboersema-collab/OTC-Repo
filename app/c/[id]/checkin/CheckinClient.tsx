"use client";

import { useState, useTransition } from "react";
import type { Challenge, Entry, NutritionState } from "@/lib/types";
import { logWorkout, removeWorkout, setNutrition, setHydration } from "./actions";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

export default function CheckinClient({
  challenge,
  weekDays,
  today,
  entries,
}: {
  challenge: Challenge;
  weekDays: string[];
  today: string;
  entries: Entry[];
}) {
  const [pending, start] = useTransition();
  const [toast, setToast] = useState("");

  function pop(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1400);
  }

  const workouts = entries.filter((e) => e.kind === "workout").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const nutByDay = (d: string) => entries.find((e) => e.kind === "nutrition" && e.day === d)?.detail as NutritionState | undefined;
  const hydByDay = (d: string) => Number(entries.find((e) => e.kind === "hydration" && e.day === d)?.detail ?? 0);

  const exPts = workouts.reduce((a, e) => a + e.points, 0);
  const nutPts = entries.filter((e) => e.kind === "nutrition").reduce((a, e) => a + e.points, 0);
  const hydLitres = weekDays.reduce((a, d) => a + hydByDay(d), 0);
  const hydPts = entries.filter((e) => e.kind === "hydration").reduce((a, e) => a + e.points, 0);
  const weekPts = exPts + nutPts + hydPts;

  function addWorkout() {
    start(async () => { await logWorkout(challenge.id, today, null); pop(`+${challenge.pt_workout} workout 💪`); });
  }
  function delWorkout(id: string) {
    start(async () => { await removeWorkout(challenge.id, id); });
  }
  function cycleNut(d: string) {
    const cur = nutByDay(d);
    const next: NutritionState | null = cur === undefined ? "clean" : cur === "clean" ? "fast" : null;
    start(async () => {
      await setNutrition(challenge.id, d, next);
      if (next === "clean") pop(`Clean day +${challenge.pt_clean} ✓`);
      else if (next === "fast") pop(`Full fast +${challenge.pt_fast} ⏳`);
    });
  }
  function bumpHyd(d: string) {
    const next = (hydByDay(d) + 1) % 6;
    start(async () => { await setHydration(challenge.id, d, next); if (next > 0) pop(`${next} L 💧`); });
  }

  return (
    <>
      <div className="banner">
        <div className="row"><h2>This Week</h2><span className="wk">{weekPts} pts</span></div>
        <div className="track"><div className="fill" style={{ width: `${Math.min(100, (weekPts / 80) * 100)}%` }} /></div>
        <div className="meta">
          <span>{workouts.length} workout{workouts.length !== 1 ? "s" : ""} · {nutPts} food · {hydLitres}L water</span>
          <span>{pending ? "saving…" : "live"}</span>
        </div>
      </div>

      <main>
        <div className="card">
          <div className="checkin-head">
            <div className="title">Today's check-in</div>
            <div className="date">Log as you go. Everything scores live and updates the leaderboard.</div>
          </div>

          {/* Exercise */}
          <div className="cat">
            <div className="cat-top">
              <span className="lbl"><span className="ico">🏃</span>Exercise <span style={{ color: "var(--brand)", fontSize: 12 }}>· {challenge.pt_workout} pts each</span></span>
              <span className="cnt"><b>{exPts}</b> pts</span>
            </div>
            <div className="wo-wrap">
              {workouts.map((w, i) => (
                <div key={w.id} className="wo">
                  📷 <span>#{i + 1}</span>{i >= 5 && <span className="bonus">BONUS</span>}
                  <span className="rm" onClick={() => delWorkout(w.id)}>✕</span>
                </div>
              ))}
              <div className="wo-add" onClick={addWorkout}>＋ Add workout</div>
            </div>
            <p className="note">5 sessions is the base — <b>every extra workout is bonus{challenge.bonus_cap ? ` (up to ${challenge.bonus_cap} extra)` : ", still " + challenge.pt_workout + " pts"}</b>. 45 min minimum, proof photo 📷.</p>
          </div>

          {/* Nutrition */}
          <div className="cat">
            <div className="cat-top">
              <span className="lbl"><span className="ico">🥗</span>Nutrition</span>
              <span className="cnt"><b>{nutPts}</b> pts</span>
            </div>
            <div className="days">
              {weekDays.map((d, i) => {
                const s = nutByDay(d);
                const cls = s === "fast" ? "fast" : s === "clean" ? "clean" : "";
                const ic = s === "fast" ? "⏳" : "🥗";
                const p = s === "fast" ? challenge.pt_fast : s === "clean" ? challenge.pt_clean : 0;
                return (
                  <div key={d} className={`day ${cls}${d === today ? " today-outline" : ""}`} onClick={() => cycleNut(d)}>
                    <span className="dn">{DOW[i]}</span><span className="dc">{ic}</span>
                    <span className="dp">{p ? "+" + p : ""}</span>
                  </div>
                );
              })}
            </div>
            <div className="legend">
              <span><span className="sw clean" />Clean · {challenge.pt_clean}</span>
              <span><span className="sw fast" />Full fast · {challenge.pt_fast}</span>
            </div>
            <p className="note">Tap a day to cycle: <b>off → clean ({challenge.pt_clean}) → fasted ({challenge.pt_fast})</b>. Fasting a full day beats clean eating.</p>
          </div>

          {/* Hydration */}
          <div className="cat">
            <div className="cat-top">
              <span className="lbl"><span className="ico">💧</span>Hydration <span style={{ color: "var(--accent)", fontSize: 12 }}>· {challenge.pt_litre} pt / litre</span></span>
              <span className="cnt"><b>{hydPts}</b> pts</span>
            </div>
            <div className="hyd">
              {weekDays.map((d, i) => {
                const l = hydByDay(d);
                return (
                  <div key={d} className={`hcell${l > 0 ? " on" : ""}${d === today ? " today-outline" : ""}`} onClick={() => bumpHyd(d)}>
                    <span className="dn">{DOW[i]}</span><span className="hv">{l}</span><span className="hu">L</span>
                  </div>
                );
              })}
            </div>
            <p className="note">Optional. Tap a day to add a litre (cycles 0–5). <b>{challenge.pt_litre} point per litre</b>, no weekly cap.</p>
          </div>
        </div>
        <p className="note" style={{ textAlign: "center" }}>Highlighted cell = today. Tap any day of this week to edit it.</p>
      </main>

      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>
    </>
  );
}
