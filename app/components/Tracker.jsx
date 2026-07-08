"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { WEEKS, TOTAL_DAYS, atMidnight, keyOf, dayIndex, dateAt, weekIndex, fmt, tasksFor } from "@/lib/schedule";
import PushManager from "./PushManager";

// ── Palette: amber phosphor on warm black ─────────────────────────────
const C = {
  bg: "#141008",
  panel: "#1E1810",
  border: "#3A2F1C",
  amber: "#FFB347",
  bright: "#FFD08A",
  dim: "#A08A62",
  faint: "#6B5A3E",
  red: "#E06A4D",
  cellEmpty: "#241C10",
  cellPart: "#7A5A26",
};

const MONO = 'ui-monospace, "Cascadia Mono", "JetBrains Mono", Menlo, Consolas, monospace';

// ── Server-backed storage ──────────────────────────────────────────────
async function loadState() {
  const res = await fetch("/api/state");
  if (!res.ok) return { days: {} };
  return res.json();
}
async function saveDay(dayKey, done, note) {
  const res = await fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dayKey, done, note }),
  });
  return res.ok;
}
async function wipeState() {
  await fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wipe: true }),
  });
}

// ── ASCII progress bar ────────────────────────────────────────────────
function AsciiBar({ frac, width = 22 }) {
  const filled = Math.round(frac * width);
  return (
    <span style={{ color: C.amber, letterSpacing: 0 }}>
      [{"█".repeat(filled)}{"░".repeat(width - filled)}] {Math.round(frac * 100)}%
    </span>
  );
}

export default function MetaPEGrindTracker() {
  const today = atMidnight(new Date());
  const clampedTodayIdx = Math.min(Math.max(dayIndex(today), 0), TOTAL_DAYS - 1);
  const [state, setState] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(clampedTodayIdx);
  const [saveErr, setSaveErr] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let live = true;
    loadState().then((s) => { if (live) setState(s); });
    return () => { live = false; };
  }, []);

  const persist = useCallback(async (next, dayKey, dayEntry) => {
    setState(next);
    const ok = await saveDay(dayKey, dayEntry.done, dayEntry.note);
    setSaveErr(!ok);
  }, []);

  const selectedDate = dateAt(selectedIdx);
  const dayKey = keyOf(selectedDate);
  const plan = useMemo(() => tasksFor(selectedDate), [selectedIdx]);
  const dayData = state?.days?.[dayKey] || { done: {}, note: "" };

  const toggle = (taskId) => {
    const nextDay = { ...dayData, done: { ...dayData.done, [taskId]: !dayData.done[taskId] } };
    const next = { ...state, days: { ...state.days, [dayKey]: nextDay } };
    persist(next, dayKey, nextDay);
  };

  const setNote = (note) => {
    const nextDay = { ...dayData, note };
    const next = { ...state, days: { ...state.days, [dayKey]: nextDay } };
    persist(next, dayKey, nextDay);
  };

  const fracOf = useCallback((idx) => {
    if (!state) return 0;
    const d = dateAt(idx);
    const p = tasksFor(d);
    const dd = state.days[keyOf(d)];
    if (!dd) return 0;
    const done = p.tasks.filter((t) => dd.done[t.id]).length;
    return done / p.tasks.length;
  }, [state]);

  const streak = useMemo(() => {
    if (!state) return 0;
    let s = 0;
    let idx = clampedTodayIdx;
    if (fracOf(idx) === 0) idx--;
    while (idx >= 0 && fracOf(idx) > 0) { s++; idx--; }
    return s;
  }, [state, clampedTodayIdx, fracOf]);

  const overall = useMemo(() => {
    if (!state) return 0;
    let sum = 0;
    for (let i = 0; i <= clampedTodayIdx; i++) sum += fracOf(i);
    return sum / (clampedTodayIdx + 1);
  }, [state, clampedTodayIdx, fracOf]);

  const beforeStart = dayIndex(today) < 0;
  const afterEnd = dayIndex(today) >= TOTAL_DAYS;
  const dayNum = clampedTodayIdx + 1;

  if (!state) {
    return (
      <div style={{ fontFamily: MONO, background: C.bg, color: C.dim, minHeight: "100vh", padding: 24 }}>
        loading tracker<span className="blink">▮</span>
        <style>{`.blink{animation:bl 1s steps(1) infinite}@keyframes bl{50%{opacity:0}}@media (prefers-reduced-motion: reduce){.blink{animation:none}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: MONO, background: C.bg, color: C.dim, minHeight: "100vh", padding: "20px 16px 48px", fontSize: 14, lineHeight: 1.6 }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        <div style={{ marginBottom: 4, color: C.faint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>
          meta pe + amazon sde prep · 7 jul → 6 sep 2026
        </div>
        <div style={{ color: C.bright, fontSize: 16, marginBottom: 16, wordBreak: "break-word" }}>
          <span style={{ color: C.amber }}>obafisayo@meta-prep</span>
          <span style={{ color: C.faint }}>:~$</span>{" "}
          {beforeStart ? "./countdown" : afterEnd ? "./done" : `./day ${dayNum} of ${TOTAL_DAYS}`}
          <span className="blink" style={{ color: C.amber }}>▮</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Link
            href="/study"
            style={{
              display: "inline-block", fontFamily: MONO, fontSize: 13, textDecoration: "none",
              color: C.amber, border: `1px solid ${C.border}`, padding: "6px 12px",
            }}
          >
            → study command centre
          </Link>
        </div>

        <PushManager />

        {saveErr && (
          <div style={{ border: `1px solid ${C.red}`, color: C.red, padding: "8px 12px", marginBottom: 16, fontSize: 12 }}>
            save failed — your last change may not persist. It will retry on your next tap.
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px", marginBottom: 20, alignItems: "baseline" }}>
          <div>
            <span style={{ color: C.faint }}>streak </span>
            <span style={{ color: streak > 0 ? C.bright : C.faint, fontSize: 18 }}>{streak}d</span>
            {streak >= 7 && <span style={{ color: C.amber }}> 🔥</span>}
          </div>
          <div>
            <span style={{ color: C.faint }}>discipline </span>
            <AsciiBar frac={overall} />
          </div>
        </div>

        {afterEnd ? (
          <div style={{ border: `1px solid ${C.border}`, background: C.panel, padding: 20, marginBottom: 20 }}>
            <div style={{ color: C.bright, marginBottom: 8 }}>The 9 weeks are over.</div>
            Whatever happens with Meta, you now know Linux at a depth most applicants never reach. That stays.
          </div>
        ) : beforeStart ? (
          <div style={{ border: `1px solid ${C.border}`, background: C.panel, padding: 20, marginBottom: 20 }}>
            Starts 7 July. Rest now — the grind is scheduled.
          </div>
        ) : null}

        <div style={{ border: `1px solid ${C.border}`, background: C.panel, padding: "16px 16px 12px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
            <div style={{ color: C.bright }}>
              {fmt(selectedDate)}
              {selectedIdx === clampedTodayIdx && !beforeStart && !afterEnd && <span style={{ color: C.amber }}> ← today</span>}
              {selectedDate.getDay() === 5 && <span style={{ color: C.amber, fontSize: 12 }}> · 🕰️ Amazon Friday</span>}
            </div>
            <div style={{ color: C.faint, fontSize: 12 }}>wk {weekIndex(selectedDate) + 1}/9</div>
          </div>
          <div style={{ color: C.faint, fontSize: 12, marginBottom: 14 }}>{plan.week.theme}</div>

          {plan.kind === "rest" && (
            <div style={{ color: C.dim, fontSize: 13, marginBottom: 10 }}>
              REST DAY. The plan works because of this day. One tap and go live your life:
            </div>
          )}

          {plan.tasks.map((t) => {
            const done = !!dayData.done[t.id];
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                style={{
                  display: "flex", gap: 10, width: "100%", textAlign: "left",
                  background: "none", border: "none", cursor: "pointer",
                  padding: "8px 4px", fontFamily: MONO, fontSize: 14, lineHeight: 1.5,
                  color: done ? C.amber : C.dim, alignItems: "flex-start",
                }}
              >
                <span aria-hidden style={{ flexShrink: 0, color: done ? C.amber : C.faint }}>
                  [{done ? "x" : " "}]
                </span>
                <span style={{ textDecorationLine: done ? "line-through" : "none", textDecorationColor: C.faint }}>
                  {t.label}{t.star && <span style={{ color: C.amber }}> ⭐min: 20 min + 3 commands</span>}
                </span>
              </button>
            );
          })}

          {plan.kind !== "rest" && (
            <div style={{ marginTop: 10 }}>
              <label style={{ color: C.faint, fontSize: 12, display: "block", marginBottom: 4 }}>
                one-line log — what did you learn / what confused you?
              </label>
              <input
                value={dayData.note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. pattern was sliding window; trigger = 'longest substring with condition'"
                style={{
                  width: "100%", boxSizing: "border-box", background: C.bg,
                  border: `1px solid ${C.border}`, color: C.bright, fontFamily: MONO,
                  fontSize: 13, padding: "8px 10px", outline: "none",
                }}
              />
            </div>
          )}
        </div>

        <div style={{ color: C.faint, fontSize: 12, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
          62-day map — tap any past day to backfill
        </div>
        <div style={{ border: `1px solid ${C.border}`, background: C.panel, padding: 12, marginBottom: 20, overflowX: "auto" }}>
          {WEEKS.map((wk, w) => (
            <div key={w} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ color: C.faint, fontSize: 11, width: 34, flexShrink: 0 }}>wk{w + 1}</span>
              {Array.from({ length: 7 }).map((_, i) => {
                const idx = w * 7 + i;
                if (idx >= TOTAL_DAYS) return <span key={i} style={{ width: 26 }} />;
                const d = dateAt(idx);
                const isFuture = idx > clampedTodayIdx || beforeStart;
                const f = fracOf(idx);
                const isSel = idx === selectedIdx;
                const bg = isFuture ? C.bg : f === 0 ? C.cellEmpty : f < 1 ? C.cellPart : C.amber;
                return (
                  <button
                    key={i}
                    disabled={isFuture}
                    onClick={() => setSelectedIdx(idx)}
                    title={fmt(d)}
                    aria-label={`${fmt(d)} — ${Math.round(f * 100)}% done`}
                    style={{
                      width: 26, height: 26, flexShrink: 0, cursor: isFuture ? "default" : "pointer",
                      background: bg,
                      border: `1px solid ${isSel ? C.bright : C.border}`,
                      opacity: isFuture ? 0.35 : 1, padding: 0,
                    }}
                  />
                );
              })}
              <span style={{ color: C.faint, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
                {wk.theme}
              </span>
            </div>
          ))}
        </div>

        <div style={{ border: `1px solid ${C.border}`, background: C.panel, padding: "10px 14px", marginBottom: 14, color: C.faint, fontSize: 11, lineHeight: 1.7 }}>
          🕰️ <span style={{ color: C.dim }}>Amazon OA protocol:</span> invite lands (check inbox Mondays) → two 90-min timed 2-problem C++ mocks first → sit the real OA in one uninterrupted block, power sorted. Meta work drops to ⭐ minimums that week.
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ color: C.faint, fontSize: 11 }}>
            missed a day? hit the ⭐ minimum tomorrow — never double up.
          </span>
          {confirmReset ? (
            <span style={{ fontSize: 12 }}>
              <span style={{ color: C.red }}>wipe all progress? </span>
              <button onClick={async () => { await wipeState(); setState({ days: {} }); setConfirmReset(false); }}
                style={{ background: "none", border: `1px solid ${C.red}`, color: C.red, fontFamily: MONO, fontSize: 12, padding: "2px 8px", cursor: "pointer", marginRight: 6 }}>
                yes, wipe
              </button>
              <button onClick={() => setConfirmReset(false)}
                style={{ background: "none", border: `1px solid ${C.faint}`, color: C.dim, fontFamily: MONO, fontSize: 12, padding: "2px 8px", cursor: "pointer" }}>
                keep
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmReset(true)}
              style={{ background: "none", border: "none", color: C.faint, fontFamily: MONO, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
              reset all data
            </button>
          )}
        </div>
      </div>

      <style>{`
        .blink{animation:bl 1.1s steps(1) infinite}
        @keyframes bl{50%{opacity:0}}
        @media (prefers-reduced-motion: reduce){.blink{animation:none}}
        button:focus-visible, input:focus-visible{outline:2px solid ${C.bright}; outline-offset:2px}
        input::placeholder{color:${C.faint}}
      `}</style>
    </div>
  );
}
