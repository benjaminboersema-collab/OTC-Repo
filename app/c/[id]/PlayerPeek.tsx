"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";
import { addDays, prettyDate, dayLog, adjustmentTotal } from "@/lib/scoring";

/** The subset of an entry the peek needs — keeps the client payload small. */
export type PeekEntry = Pick<Entry, "day" | "kind" | "detail" | "points">;

export default function PlayerPeek({
  name,
  entries,
  startDate,
  endDate,
  today,
  children,
}: {
  name: string;
  entries: PeekEntry[];
  startDate: string;
  endDate: string;
  today: string;
  children: React.ReactNode;
}) {
  // open on the most useful day: today if the challenge is running, else the nearest edge
  const initial = today < startDate ? startDate : today > endDate ? endDate : today;
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(initial);

  const log = dayLog(entries, day);
  const adjustment = adjustmentTotal(entries);
  const { workout: ex, nutrition: nut, hydration: hyd, bonus: bon } = log;

  const sessions = Number(ex?.detail ?? 0) || 0;
  const litres = Number(hyd?.detail ?? 0) || 0;

  const canBack = day > startDate;
  const canFwd = day < endDate;

  function close() {
    setOpen(false);
    setDay(initial);
  }

  return (
    <>
      <button type="button" className="peekbtn" onClick={() => setOpen(true)} title={`See ${name}'s day`}>
        {children}
      </button>

      {open && (
        <div className="peek-back" role="dialog" aria-modal="true" aria-label={`${name}'s day`} onClick={close}>
          <div className="peek" onClick={(e) => e.stopPropagation()}>
            <div className="peek-head">
              <div>
                <div className="peek-name">{name}</div>
                <div className="peek-sub">{prettyDate(day)}</div>
              </div>
              <button type="button" className="chip" onClick={close} aria-label="Close">✕</button>
            </div>

            <div className="peek-nav">
              <button type="button" className="chip" disabled={!canBack} onClick={() => setDay(addDays(day, -1))}>
                ◀ Prev
              </button>
              <button type="button" className="chip" disabled={day === initial} onClick={() => setDay(initial)}>
                {initial === today ? "Today" : prettyDate(initial, false)}
              </button>
              <button type="button" className="chip" disabled={!canFwd} onClick={() => setDay(addDays(day, 1))}>
                Next ▶
              </button>
            </div>

            <div className="peek-body">
              {log.count === 0 ? (
                <div className="empty">Nothing logged on this day.</div>
              ) : (
                <>
                  {ex && (
                    <Line icon="🏃" label="Exercise" what={`${sessions} session${sessions === 1 ? "" : "s"}`} pts={ex.points} />
                  )}
                  {nut && (
                    <Line
                      icon={nut.detail === "fast" ? "⏳" : "🥗"}
                      label="Nutrition"
                      what={nut.detail === "fast" ? "Full-day fast" : "Clean day"}
                      pts={nut.points}
                    />
                  )}
                  {hyd && (
                    <Line icon="💧" label="Hydration" what={`${litres} litre${litres === 1 ? "" : "s"}`} pts={hyd.points} />
                  )}
                  {bon && (
                    <Line icon="🎯" label="Weekly bonus" what="Hit the bonus challenge" pts={bon.points} />
                  )}
                </>
              )}
            </div>

            <div className="peek-foot">
              <span>Day total</span>
              <b>{log.total} pts</b>
            </div>
            {adjustment !== 0 && (
              <p className="note" style={{ margin: "10px 16px 14px" }}>
                Includes an owner adjustment of <b>{adjustment > 0 ? `+${adjustment}` : adjustment}</b> pts on their
                season total (not counted in this day).
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Line({ icon, label, what, pts }: { icon: string; label: string; what: string; pts: number }) {
  return (
    <div className="rule">
      <div className="rico">{icon}</div>
      <div className="rinfo">
        <div className="rt">{label}</div>
        <div className="rd">{what}</div>
      </div>
      <div className="rp">{pts}<span>pts</span></div>
    </div>
  );
}
