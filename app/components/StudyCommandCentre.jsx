"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";

// ─── Amber phosphor palette (matches the Grind Tracker) ───
const C = {
  bg: "#141008", panel: "#1E1810", panel2: "#241C10", border: "#3A2F1C",
  amber: "#FFB347", bright: "#FFD08A", dim: "#A08A62", faint: "#6B5A3E",
  red: "#E06A4D", green: "#9DBF6B",
};
const MONO = 'ui-monospace, "Cascadia Mono", "JetBrains Mono", Menlo, Consolas, monospace';

const START = new Date(2026, 6, 7);

// ─── Roadmap knowledge the AI uses for context ───
const WEEKS = [
  { theme: "Finish Ch.2 + Ch.3 Devices", topics: "shell basics, stdin/stdout/stderr, redirection, pipes, job control (Ctrl-Z, fg, bg, &), kill and signals (SIGTERM/SIGKILL/SIGHUP), ps, environment variables, PATH, globbing, find/grep/less, the Linux directory hierarchy (/bin /etc /var /proc /usr), archiving with tar; devices: /dev, device files (block vs character), major/minor numbers, udev and udevadm, lsblk, SCSI and disk device naming (sda, sdb)" },
  { theme: "Ch.4 Disks & Filesystems", topics: "MBR vs GPT partitions, fdisk/parted, filesystem types (ext4, xfs, btrfs), mkfs, mounting and /etc/fstab, UUIDs, fsck, inodes and the 'disk full but df disagrees' problem, df vs du, hard vs symbolic links, swap space, loop devices" },
  { theme: "Ch.5–6 Boot & systemd", topics: "boot sequence: firmware/BIOS/UEFI → bootloader (GRUB) → kernel init → initramfs → PID 1; kernel parameters, dmesg; systemd: units, targets, dependencies, systemctl, journalctl, writing unit files, comparing with SysV init" },
  { theme: "Ch.7–8 Processes & Resources", topics: "syslog and journald, cron and at, /etc/passwd and user management, PAM basics; processes deep: fork/exec, process states, zombies and orphans, strace and ltrace, lsof, file descriptors, load average vs CPU%, uninterruptible sleep (D state), memory: RSS vs VSZ, page cache, OOM killer, top/htop fields, nice and priorities, cgroups basics" },
  { theme: "Ch.9–10 Networking", topics: "IP addressing and subnets, routing tables (ip route), ARP, DHCP, DNS resolution chain (dig, /etc/resolv.conf, nsswitch), interfaces (ip addr), TCP vs UDP, the three-way handshake, ports and sockets, ss/netstat, tcpdump, curl -v, what happens when you type a URL, NAT, localhost and loopback, firewalls/iptables concepts" },
  { theme: "Ch.11–12 Shell Scripting", topics: "bash scripting: shebang, variables, quoting rules, exit codes and $?, test/[ ], if/case/for/while, command substitution, functions, set -e/-u/-o pipefail, reading input, awk/sed one-liners; ssh keys and config, scp, rsync flags and delta transfer" },
  { theme: "Ship Go project · APPLY", topics: "Go fundamentals: goroutines, channels, error handling, structs and interfaces, reading /proc from Go; plus full-roadmap Linux review — boot, processes, filesystems, networking all fair game" },
  { theme: "Interview recon + timed practice", topics: "everything weeks 1–7 combined: full-system troubleshooting walkthroughs, boot-to-login narrative, URL-to-page narrative, slow-server runbook, disk mysteries, zombie processes, load average interpretation, strace-driven debugging" },
  { theme: "Mocks + taper", topics: "light full-roadmap review, interview storytelling, behavioural prep, calibrated confidence" },
];

const currentWeekIdx = () => {
  const d = Math.floor((new Date() - START) / 86400000 / 7);
  return Math.min(8, Math.max(0, d));
};

// ─── Server-backed storage ───
async function loadStore() {
  const res = await fetch("/api/study-state");
  if (!res.ok) return { weakAreas: [], sessions: 0 };
  return res.json();
}
async function saveStore(data) {
  const res = await fetch("/api/study-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.ok;
}

// ─── Claude API (proxied through /api/claude so the key stays server-side) ───
async function askClaude(messages, system) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API ${res.status}`);
  return data.text;
}
const stripFences = (t) => t.replace(/```json|```/g, "").trim();

// ─── Session mode definitions ───
const MODES = [
  { id: "quiz", icon: "?", name: "quiz", desc: "5 questions on the week's material. Graded, explained, misses remembered." },
  { id: "dive", icon: "»", name: "deep dive", desc: "Pick any topic. Tutor mode — push as deep as you want." },
  { id: "mock-sys", icon: "◔", name: "mock: systems", desc: "30-min timed Linux/systems interview. Real Meta PE style." },
  { id: "mock-code", icon: "{}", name: "mock: coding", desc: "45-min timed coding interview. One problem, follow-ups, debrief." },
  { id: "server", icon: "⚠", name: "broken server", desc: "I'm a sick machine. You type commands, I answer as the terminal. Diagnose me." },
  { id: "oa-mock", icon: "🕰️", name: "amazon OA mock", desc: "90-min timed, 2 problems, C++, no revisiting — exactly like the real assessment." },
  { id: "worksim", icon: "☰", name: "work-sim drill", desc: "Rank responses to workplace scenarios. Debriefed against the Leadership Principles." },
  { id: "revisit", icon: "↻", name: "revisit weak areas", desc: "Targeted quiz built from everything you've missed before." },
];

function systemPromptFor(mode, weekIdx, weakAreas, topic) {
  const wk = WEEKS[weekIdx];
  const base = `You are running a study session for Obafisayo, a UNILAG CS student in Lagos preparing for the Meta Production Engineering internship and the Amazon SDE Intern 2027 online assessment (already applied; Dublin, Q4 2027). He is in week ${weekIdx + 1} of 9 of his prep roadmap. This week's theme: "${wk.theme}". Topics in scope: ${wk.topics}. He learns from "How Linux Works" (2nd ed, Brian Ward) and does daily LeetCode in C++. Be warm but rigorous. Use UK English. Keep responses tight — this renders in a narrow side panel.`;
  const weak = weakAreas.length ? ` Previously weak areas to weave in when relevant: ${weakAreas.slice(-12).join("; ")}.` : "";
  switch (mode) {
    case "dive":
      return base + weak + ` Mode: DEEP DIVE on "${topic}". Act as a patient expert tutor. Explain clearly with concrete terminal examples he can run in WSL. After each explanation, ask ONE probing question to check understanding before going deeper. Never lecture for more than ~150 words per turn.`;
    case "mock-sys":
      return base + weak + ` Mode: TIMED SYSTEMS INTERVIEW (30 min). Play a friendly but probing Meta Production Engineering interviewer. Ask ONE systems/Linux question at a time from this week's scope and earlier weeks. Probe follow-ups on his answers like a real interviewer ("why?", "what would you check next?", "what does that number actually mean?"). Give NO teaching or answers during the interview — only probe. If he flounders, offer one small hint then move on. When he says TIME IS UP or END INTERVIEW, deliver a structured debrief: what was strong, what a real interviewer would flag, exact topics to revise, and a hire-signal rating out of 5 with honest justification.`;
    case "mock-code":
      return base + weak + ` Mode: TIMED CODING INTERVIEW (45 min). Play a Meta interviewer. Present ONE LeetCode-style problem (easy-medium, PE flavour: arrays, strings, hashmaps, or log parsing) as an interviewer would — problem statement only, no hints. He codes in C++. Ask him to talk through his approach BEFORE coding. Respond as an interviewer: clarifying answers, "what's the complexity?", edge-case probes. Do NOT write solution code for him during the interview. On TIME IS UP or END INTERVIEW: debrief with correctness assessment, complexity analysis, what he communicated well or poorly, and a hire-signal rating out of 5.`;
    case "server":
      return base + weak + ` Mode: BROKEN SERVER SIMULATION. Invent ONE realistic Linux failure scenario appropriate to what he's covered so far (weeks 1–${weekIdx + 1} topics only — e.g. full disk/inodes, runaway process, service down, bad cron, permission issue, DNS misconfig if networking is covered). Open with a one-line ticket like a pager alert (e.g. "ALERT: web-01 — users report the app is down"). From then on you ARE the server's terminal: when he sends a command, reply with ONLY realistic command output in a code block — no commentary, no hints. Stay internally consistent across all outputs. If a command has a typo or wrong flag, return the real error a shell would. If he sends plain English instead of a command, respond as a terse senior colleague on the incident call (one sentence max). When he states a diagnosis, confirm or deny honestly; when he states the FIX and it's correct, show the recovery output and then break character for a short debrief: root cause chain, what he checked efficiently, what he missed, time-wasters.`;
    case "oa-mock":
      return base + weak + ` Mode: TIMED AMAZON OA MOCK (90 min, TWO problems, C++). Simulate Amazon's SDE intern online assessment. Present Problem 1 of 2 immediately: LeetCode easy-medium, Amazon flavour (hash maps, sliding window, BFS/DFS on grids, heaps, intervals, strings) — full problem statement with input/output format and constraints, exactly as an OA platform would. NO hints, NO teaching during the assessment; you may answer clarifying questions about the problem statement only. When he submits a solution, silently assess it, say only "Submitted. Problem 2 of 2:" and present the second problem (a different pattern) — in the real OA he cannot revisit a submitted question, so do not discuss Problem 1 yet. On TIME IS UP or END INTERVIEW: full debrief on BOTH problems — correctness against edge cases, complexity, code cleanliness, pacing advice, and an honest pass/borderline/fail verdict for OA standards.`;
    case "worksim":
      return base + ` Mode: AMAZON WORK-SIMULATION DRILL. Simulate Amazon's work-style simulation: present ONE realistic workplace scenario at a time — a mock email or message from a teammate, manager, or customer-facing situation an SDE intern would face — followed by four plausible response options labelled a–d. Ask him to rank them from most to least effective (or pick what he'd do first). After he answers: reveal the ranking Amazon's Leadership Principles would reward, name the specific principles in play (Customer Obsession, Ownership, Bias for Action, Dive Deep, Earn Trust, Deliver Results dominate), and debrief his reasoning in 3-5 sentences — praise sound judgement, flag principle conflicts he missed. Include recurring tensions: speed vs quality, own task vs helping a teammate, escalate vs own it, act now vs gather data. Every 5 scenarios, summarise which principles he's calibrated on and which need work. Remind him once at the start: the real assessment has consistency checks — genuine judgement beats performing an ideal employee.`;
    case "revisit":
      return base + ` Mode: WEAK-AREA REVISION. His logged weak areas: ${weakAreas.length ? weakAreas.join("; ") : "none logged yet — quiz broadly on weeks 1 through " + (weekIdx + 1)}. Quiz him ONE question at a time targeting exactly these gaps, mixing recall and applied questions. After each answer: grade it honestly, explain the correct answer in 2-4 sentences, then next question. Every 5 questions, give a mini progress summary.`;
    default:
      return base;
  }
}

const QUIZ_SYSTEM = (weekIdx, weakAreas) => {
  const wk = WEEKS[weekIdx];
  return `Generate a quiz for a Meta Production Engineering intern candidate on: ${wk.topics}. ${weakAreas.length ? "Bias 1-2 questions toward these past weak areas if in scope: " + weakAreas.slice(-8).join("; ") + "." : ""} Respond with ONLY valid JSON, no markdown fences, no preamble: {"questions":[{"q":"question text (may include a short command or output snippet)","options":["A","B","C","D"],"answer":0,"topic":"2-4 word topic tag","explain":"2-3 sentence explanation of the right answer"}]} — exactly 5 questions, 4 options each, "answer" is the 0-based index of the correct option. Mix conceptual, practical 'what does this command do/output', and one 'spot the false statement'. UK English.`;
};

// ─── Small UI atoms ───
const btnStyle = (primary) => ({
  fontFamily: MONO, fontSize: 13, cursor: "pointer", padding: "8px 14px",
  background: primary ? C.amber : "transparent",
  color: primary ? C.bg : C.dim,
  border: `1px solid ${primary ? C.amber : C.border}`,
});

function Spinner() {
  return <span className="blink" style={{ color: C.amber }}>▮</span>;
}

// ─── Chat-style session (dive / mocks / server / revisit) ───
function ChatSession({ mode, weekIdx, weakAreas, topic, onExit, onWeakAreas }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [secs, setSecs] = useState(mode === "mock-sys" ? 30 * 60 : mode === "mock-code" ? 45 * 60 : mode === "oa-mock" ? 90 * 60 : null);
  const [running, setRunning] = useState(false);
  const [ended, setEnded] = useState(false);
  const bottomRef = useRef(null);
  const system = useMemo(() => systemPromptFor(mode, weekIdx, weakAreas, topic), [mode, weekIdx, weakAreas, topic]);
  const isTimed = secs !== null;
  const isTerminal = mode === "server";

  const send = useCallback(async (text) => {
    const userMsg = { role: "user", content: text };
    const history = [...msgs, userMsg];
    setMsgs(history);
    setBusy(true); setErr("");
    try {
      const reply = await askClaude(history.map(({ role, content }) => ({ role, content })), system);
      setMsgs([...history, { role: "assistant", content: reply }]);
    } catch (e) {
      setErr("Connection hiccup — tap retry.");
      setMsgs(history);
    } finally { setBusy(false); }
  }, [msgs, system]);

  // kick off the session
  useEffect(() => {
    const opener = {
      dive: `Let's dive into: ${topic || "this week's material"}. Start from where a strong beginner would need it.`,
      "mock-sys": "I'm ready. Start the systems interview.",
      "mock-code": "I'm ready. Start the coding interview.",
      server: "I'm on call. Page me.",
      "oa-mock": "I'm ready. Start the Amazon OA — Problem 1 of 2.",
      worksim: "I'm ready. First scenario, please.",
      revisit: "Start the revision quiz.",
    }[mode];
    if (opener && msgs.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      send(opener);
      if (isTimed) setRunning(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // countdown
  useEffect(() => {
    if (!running || ended) return;
    const t = setInterval(() => setSecs((s) => {
      if (s <= 1) { clearInterval(t); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [running, ended]);

  useEffect(() => {
    if (isTimed && secs === 0 && !ended) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnded(true); setRunning(false);
      send("TIME IS UP. Please give me my full debrief now.");
    }
  }, [secs, isTimed, ended, send]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const endEarly = () => { setEnded(true); setRunning(false); send("END INTERVIEW — give me my full debrief now."); };
  const mm = isTimed ? String(Math.floor(secs / 60)).padStart(2, "0") : "";
  const ss = isTimed ? String(secs % 60).padStart(2, "0") : "";
  const low = isTimed && secs < 300;

  const logWeak = () => {
    const t = prompt("Log a weak area from this session (short phrase):");
    if (t && t.trim()) onWeakAreas(t.trim());
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", gap: 8 }}>
        <div style={{ color: C.bright, fontSize: 13 }}>
          <span style={{ color: C.amber }}>{MODES.find((m) => m.id === mode)?.name}</span>
          <span style={{ color: C.faint }}> · wk {weekIdx + 1}</span>
          {topic && <span style={{ color: C.dim }}> · {topic}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isTimed && (
            <span style={{ color: low ? C.red : C.bright, fontSize: 15 }} aria-live={low ? "polite" : "off"}>
              ⏱ {mm}:{ss}
            </span>
          )}
          {isTimed && !ended && <button onClick={endEarly} style={btnStyle(false)}>end + debrief</button>}
          <button onClick={logWeak} style={btnStyle(false)} title="Save a weak area for future revision">+ weak area</button>
          <button onClick={onExit} style={btnStyle(false)}>← dash</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ color: C.faint, fontSize: 11, marginBottom: 2 }}>
              {m.role === "user" ? (isTerminal ? "you@web-01:~$" : "you >") : (isTerminal ? "web-01" : "claude >")}
            </div>
            <div style={{
              color: m.role === "user" ? C.bright : C.dim, whiteSpace: "pre-wrap", wordBreak: "break-word",
              fontSize: 13, lineHeight: 1.55,
              ...(isTerminal && m.role === "assistant" ? { background: C.panel2, border: `1px solid ${C.border}`, padding: "8px 10px" } : {}),
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && <div style={{ color: C.faint, fontSize: 13 }}>thinking<Spinner /></div>}
        {err && (
          <div style={{ color: C.red, fontSize: 13 }}>
            {err}{" "}
            <button style={{ ...btnStyle(false), borderColor: C.red, color: C.red, padding: "2px 8px" }}
              onClick={() => { const last = msgs[msgs.length - 1]; if (last?.role === "user") { setMsgs(msgs.slice(0, -1)); send(last.content); } }}>
              retry
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${C.border}` }}>
        {isTerminal && <span style={{ color: C.amber, alignSelf: "center", fontSize: 13 }}>$</span>}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && input.trim() && !busy) {
              e.preventDefault(); send(input.trim()); setInput("");
            }
          }}
          placeholder={isTerminal ? "type a shell command… (or plain English to your colleague)" : "type… (Enter to send, Shift+Enter for newline)"}
          rows={2}
          style={{
            flex: 1, resize: "none", background: C.bg, color: C.bright, fontFamily: MONO, fontSize: 13,
            border: `1px solid ${C.border}`, padding: "8px 10px", outline: "none",
          }}
        />
        <button disabled={busy || !input.trim()} onClick={() => { send(input.trim()); setInput(""); }}
          style={{ ...btnStyle(true), opacity: busy || !input.trim() ? 0.45 : 1 }}>
          send
        </button>
      </div>
    </div>
  );
}

// ─── Quiz session (structured, locally graded) ───
function QuizSession({ weekIdx, weakAreas, onExit, onWeakAreas }) {
  const [phase, setPhase] = useState("loading"); // loading | active | done | error
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [results, setResults] = useState([]);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const raw = await askClaude(
        [{ role: "user", content: "Generate the quiz now." }],
        QUIZ_SYSTEM(weekIdx, weakAreas)
      );
      const parsed = JSON.parse(stripFences(raw));
      if (!parsed.questions?.length) throw new Error("bad shape");
      setQuestions(parsed.questions);
      setIdx(0); setResults([]); setPicked(null);
      setPhase("active");
    } catch { setPhase("error"); }
  }, [weekIdx, weakAreas]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const q = questions[idx];
  const answered = picked !== null;

  const choose = (i) => {
    if (answered) return;
    setPicked(i);
    const correct = i === q.answer;
    setResults((r) => [...r, { topic: q.topic, correct }]);
    if (!correct) onWeakAreas(q.topic);
  };

  const next = () => {
    setPicked(null);
    if (idx + 1 < questions.length) setIdx(idx + 1);
    else setPhase("done");
  };

  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ color: C.bright, fontSize: 13 }}>
        <span style={{ color: C.amber }}>quiz</span>
        <span style={{ color: C.faint }}> · wk {weekIdx + 1} · {WEEKS[weekIdx].theme}</span>
      </div>
      <button onClick={onExit} style={btnStyle(false)}>← dash</button>
    </div>
  );

  if (phase === "loading") return (
    <div style={{ height: "100%" }}>{header}<div style={{ padding: 20, color: C.dim }}>compiling questions<Spinner /></div></div>
  );
  if (phase === "error") return (
    <div style={{ height: "100%" }}>{header}
      <div style={{ padding: 20, color: C.red, fontSize: 13 }}>
        Quiz generation failed. <button onClick={load} style={{ ...btnStyle(false), borderColor: C.red, color: C.red }}>retry</button>
      </div>
    </div>
  );
  if (phase === "done") {
    const score = results.filter((r) => r.correct).length;
    const missed = results.filter((r) => !r.correct).map((r) => r.topic);
    return (
      <div style={{ height: "100%" }}>{header}
        <div style={{ padding: 20 }}>
          <div style={{ color: C.bright, fontSize: 22, marginBottom: 8 }}>{score}/{results.length}</div>
          <div style={{ color: C.dim, fontSize: 13, marginBottom: 14 }}>
            {score === results.length ? "Flawless. This material is yours." :
             score >= 3 ? "Solid — patch the gaps below and re-run." :
             "Rough one — that's the system working. These gaps are now logged for revisit mode."}
          </div>
          {missed.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: C.faint, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>logged weak areas</div>
              {missed.map((t, i) => <div key={i} style={{ color: C.red, fontSize: 13 }}>▸ {t}</div>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={load} style={btnStyle(true)}>new quiz</button>
            <button onClick={onExit} style={btnStyle(false)}>back to dash</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {header}
      <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
        <div style={{ color: C.faint, fontSize: 11, marginBottom: 10 }}>
          question {idx + 1} / {questions.length} · {q.topic}
        </div>
        <div style={{ color: C.bright, fontSize: 14, whiteSpace: "pre-wrap", marginBottom: 16, lineHeight: 1.6 }}>{q.q}</div>
        {q.options.map((opt, i) => {
          const isRight = answered && i === q.answer;
          const isWrongPick = answered && i === picked && i !== q.answer;
          return (
            <button key={i} onClick={() => choose(i)}
              style={{
                display: "block", width: "100%", textAlign: "left", fontFamily: MONO, fontSize: 13,
                padding: "10px 12px", marginBottom: 8, cursor: answered ? "default" : "pointer",
                background: isRight ? "rgba(157,191,107,0.12)" : isWrongPick ? "rgba(224,106,77,0.12)" : C.panel,
                border: `1px solid ${isRight ? C.green : isWrongPick ? C.red : C.border}`,
                color: isRight ? C.green : isWrongPick ? C.red : C.dim, lineHeight: 1.5,
              }}>
              <span style={{ color: C.faint }}>[{String.fromCharCode(97 + i)}] </span>{opt}
            </button>
          );
        })}
        {answered && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: C.panel2, border: `1px solid ${C.border}`, color: C.dim, fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: picked === q.answer ? C.green : C.red }}>
              {picked === q.answer ? "✓ correct. " : "✗ not quite. "}
            </span>
            {q.explain}
          </div>
        )}
      </div>
      {answered && (
        <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
          <button onClick={next} style={btnStyle(true)}>
            {idx + 1 < questions.length ? "next question →" : "see score"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard home ───
export default function StudyCommandCentre() {
  const [store, setStore] = useState(null);
  const [view, setView] = useState({ screen: "home" });
  const [weekIdx, setWeekIdx] = useState(currentWeekIdx());
  const [diveTopic, setDiveTopic] = useState("");

  useEffect(() => {
    let live = true;
    loadStore().then((s) => { if (live) setStore(s || { weakAreas: [], sessions: 0 }); });
    return () => { live = false; };
  }, []);

  const addWeak = useCallback((topic) => {
    setStore((s) => {
      const next = { ...s, weakAreas: [...new Set([...(s.weakAreas || []), topic])].slice(-40) };
      saveStore(next);
      return next;
    });
  }, []);

  const startSession = (mode, topic) => {
    setStore((s) => { const next = { ...s, sessions: (s.sessions || 0) + 1 }; saveStore(next); return next; });
    setView({ screen: mode === "quiz" ? "quiz" : "chat", mode, topic });
  };

  if (!store) return (
    <div style={{ fontFamily: MONO, background: C.bg, color: C.dim, height: "100vh", padding: 24 }}>
      booting<Spinner />
      <style>{blinkCss}</style>
    </div>
  );

  const wk = WEEKS[weekIdx];

  return (
    <div style={{ fontFamily: MONO, background: C.bg, height: "100vh", display: "flex", flexDirection: "column" }}>
      {view.screen === "home" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            <div style={{ color: C.faint, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
              study command centre
            </div>
            <div style={{ color: C.bright, fontSize: 16, marginBottom: 16 }}>
              <span style={{ color: C.amber }}>obafisayo@meta-prep</span>
              <span style={{ color: C.faint }}>:~$</span> ./session<span className="blink" style={{ color: C.amber }}>▮</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Link
                href="/"
                style={{
                  display: "inline-block", fontFamily: MONO, fontSize: 13, textDecoration: "none",
                  color: C.amber, border: `1px solid ${C.border}`, padding: "6px 12px",
                }}
              >
                ← tracker
              </Link>
            </div>

            {/* week context */}
            <div style={{ border: `1px solid ${C.border}`, background: C.panel, padding: "12px 14px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ color: C.faint, fontSize: 11 }}>studying as</div>
                <div style={{ color: C.bright, fontSize: 14 }}>week {weekIdx + 1}/9 · {wk.theme}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setWeekIdx((w) => Math.max(0, w - 1))} style={btnStyle(false)} aria-label="previous week">‹</button>
                {weekIdx !== currentWeekIdx() && (
                  <button onClick={() => setWeekIdx(currentWeekIdx())} style={btnStyle(false)}>today</button>
                )}
                <button onClick={() => setWeekIdx((w) => Math.min(8, w + 1))} style={btnStyle(false)} aria-label="next week">›</button>
              </div>
            </div>

            {/* session cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginBottom: 18 }}>
              {MODES.map((m) => (
                <button key={m.id}
                  onClick={() => {
                    if (m.id === "dive") return; // dive uses the topic input below
                    startSession(m.id);
                  }}
                  disabled={m.id === "dive"}
                  style={{
                    textAlign: "left", fontFamily: MONO, background: C.panel, border: `1px solid ${C.border}`,
                    padding: "14px 14px 12px", cursor: m.id === "dive" ? "default" : "pointer", color: C.dim,
                  }}>
                  <div style={{ color: C.amber, fontSize: 15, marginBottom: 4 }}>
                    <span style={{ display: "inline-block", width: 22 }}>{m.icon}</span>{m.name}
                    {m.id === "revisit" && store.weakAreas?.length > 0 && (
                      <span style={{ color: C.red, fontSize: 11 }}> ({store.weakAreas.length} logged)</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>{m.desc}</div>
                  {m.id === "dive" && (
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <input
                        value={diveTopic}
                        onChange={(e) => setDiveTopic(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && diveTopic.trim()) startSession("dive", diveTopic.trim()); }}
                        placeholder="topic… e.g. inodes, signals"
                        style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, color: C.bright, fontFamily: MONO, fontSize: 12, padding: "6px 8px", outline: "none", minWidth: 0 }}
                      />
                      <button onClick={() => diveTopic.trim() && startSession("dive", diveTopic.trim())} style={{ ...btnStyle(true), padding: "6px 10px", fontSize: 12 }}>go</button>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* weak areas ledger */}
            <div style={{ border: `1px solid ${C.border}`, background: C.panel, padding: "12px 14px" }}>
              <div style={{ color: C.faint, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>
                weak-area ledger · fuels revisit mode
              </div>
              {store.weakAreas?.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {store.weakAreas.map((t, i) => (
                    <span key={i} style={{ fontSize: 11, color: C.red, border: `1px solid ${C.border}`, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {t}
                      <button
                        aria-label={`mark ${t} as mastered`}
                        title="mastered — remove"
                        onClick={() => setStore((s) => { const next = { ...s, weakAreas: s.weakAreas.filter((x) => x !== t) }; saveStore(next); return next; })}
                        style={{ background: "none", border: "none", color: C.green, cursor: "pointer", fontFamily: MONO, fontSize: 11, padding: 0 }}>
                        ✓
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color: C.faint, fontSize: 12 }}>
                  empty — quiz misses land here automatically, or log them manually inside any session. An empty ledger after week 3 means you&rsquo;re not being quizzed hard enough.
                </div>
              )}
            </div>

            <div style={{ color: C.faint, fontSize: 11, marginTop: 14 }}>
              sessions run: {store.sessions || 0} · timers are real — mock interviews end themselves
            </div>
          </div>
        </div>
      )}

      {view.screen === "chat" && (
        <ChatSession
          mode={view.mode} weekIdx={weekIdx} weakAreas={store.weakAreas || []} topic={view.topic}
          onExit={() => setView({ screen: "home" })} onWeakAreas={addWeak}
        />
      )}
      {view.screen === "quiz" && (
        <QuizSession
          weekIdx={weekIdx} weakAreas={store.weakAreas || []}
          onExit={() => setView({ screen: "home" })} onWeakAreas={addWeak}
        />
      )}
      <style>{blinkCss}</style>
    </div>
  );
}

const blinkCss = `
.blink{animation:bl 1.1s steps(1) infinite}
@keyframes bl{50%{opacity:0}}
@media (prefers-reduced-motion: reduce){.blink{animation:none}}
button:focus-visible, input:focus-visible, textarea:focus-visible{outline:2px solid ${C.bright}; outline-offset:2px}
input::placeholder, textarea::placeholder{color:${C.faint}}
*{box-sizing:border-box}
`;
