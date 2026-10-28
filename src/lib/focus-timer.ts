import { useEffect, useState, useSyncExternalStore } from "react";
import { logActivity } from "./activity-log";

export type FocusMode = "work" | "break";

export type FocusState = {
  isRunning: boolean;
  mode: FocusMode;
  secondsLeft: number; // while paused; while running it is derived from endsAt
  ticketKey: string | null;
  ticketTitle: string | null;
  endsAt: number | null; // epoch ms while running, so the countdown does not drift and every tab agrees
};

export const WORK_SECONDS = 25 * 60;
export const BREAK_SECONDS = 5 * 60;

const KEY = "collab-workspace:focus-timer";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

const isState = (v: unknown): v is FocusState => {
  if (typeof v !== "object" || v === null) return false;
  const s = v as FocusState;
  return (
    typeof s.isRunning === "boolean" &&
    (s.mode === "work" || s.mode === "break") &&
    typeof s.secondsLeft === "number" &&
    (s.ticketKey === null || typeof s.ticketKey === "string") &&
    (s.ticketTitle === null || typeof s.ticketTitle === "string") &&
    (s.endsAt === null || typeof s.endsAt === "number")
  );
};

// useSyncExternalStore needs a referentially stable snapshot, so the parsed state is cached per raw string.
let cachedRaw: string | null = null;
let cachedState: FocusState | null = null;

function readState(): FocusState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // storage blocked: the timer lives only for this session below
  }
  if (raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  cachedState = null;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isState(parsed)) cachedState = parsed;
    } catch {
      // corrupt JSON: no timer
    }
  }
  return cachedState;
}

function writeState(state: FocusState | null) {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    return;
  }
  notify();
}

export const remainingSeconds = (s: FocusState, now: number) =>
  s.isRunning && s.endsAt !== null ? Math.max(0, Math.ceil((s.endsAt - now) / 1000)) : s.secondsLeft;

// A short two-note chime from a Web Audio oscillator. Browsers may refuse to play sound before the page has been
// interacted with; that just means no chime.
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.22;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    // no audio available
  }
}

// ---------------------------------------------------------------- actions (usable without the hook)

export function startFocusTimer(ticketKey: string | null, ticketTitle: string | null) {
  writeState({
    isRunning: true,
    mode: "work",
    secondsLeft: WORK_SECONDS,
    ticketKey,
    ticketTitle,
    endsAt: Date.now() + WORK_SECONDS * 1000,
  });
}

export function pauseFocusTimer() {
  const s = readState();
  if (!s || !s.isRunning) return;
  writeState({ ...s, isRunning: false, secondsLeft: remainingSeconds(s, Date.now()), endsAt: null });
}

export function resumeFocusTimer() {
  const s = readState();
  if (!s || s.isRunning) return;
  writeState({ ...s, isRunning: true, endsAt: Date.now() + s.secondsLeft * 1000 });
}

export function resetFocusTimer() {
  writeState(null);
}

function startBreak(s: FocusState) {
  writeState({ ...s, isRunning: true, mode: "break", secondsLeft: BREAK_SECONDS, endsAt: Date.now() + BREAK_SECONDS * 1000 });
}

export function skipToBreak() {
  const s = readState();
  if (s) startBreak(s);
}

// Called by the one component that ticks. Re-reads the stored state first, so if another tab already moved the
// timer on, this does nothing and the chime and the activity entry happen once.
export function completeIfFinished() {
  const s = readState();
  if (!s || !s.isRunning || s.endsAt === null || s.endsAt > Date.now()) return;
  chime();
  if (s.mode === "work") {
    logActivity({
      kind: "task",
      title: "🎯 Completed 25m Focus Session",
      detail: s.ticketKey ? `Focused on ${s.ticketKey}: ${s.ticketTitle ?? ""}`.trim() : "Focused on a task",
    });
    startBreak(s);
  } else {
    writeState(null); // the break is over
  }
}

// ---------------------------------------------------------------- hook

export function useFocusTimer() {
  const state = useSyncExternalStore(subscribe, readState, () => null);
  const [now, setNow] = useState(0);
  const running = state?.isRunning === true;

  // While running: refresh every second and finish the session when its time is up.
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setNow(Date.now());
      completeIfFinished();
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [running]);

  const secondsLeft = state ? (running && now > 0 ? remainingSeconds(state, now) : state.secondsLeft) : 0;

  return {
    state,
    secondsLeft,
    // Module-level functions, so their identity never changes.
    startTimer: startFocusTimer,
    pauseTimer: pauseFocusTimer,
    resumeTimer: resumeFocusTimer,
    resetTimer: resetFocusTimer,
    skipToBreak,
  };
}
