"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Coffee, Pause, Play, RotateCcw } from "lucide-react";
import { useFocusTimer } from "@/lib/focus-timer";

const format = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

// Floating Pomodoro bar, shown on every page while a session is running or paused; the button on a work item starts it.
export default function FocusTimerDock() {
  const { state, secondsLeft, pauseTimer, resumeTimer, resetTimer, skipToBreak } = useFocusTimer();
  const [collapsed, setCollapsed] = useState(false);
  const active = state !== null;

  // Esc tucks the bar away (it never stops the timer), unless a dialog is open and needs the key.
  useEffect(() => {
    if (!active || collapsed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) setCollapsed(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, collapsed]);

  if (!state) return null;

  const onBreak = state.mode === "break";
  const label = onBreak ? "Break" : "Focus";
  const time = format(secondsLeft);
  const pulse = state.isRunning ? "animate-pulse" : "";

  if (collapsed) {
    return (
      <div className="no-print fixed bottom-4 left-1/2 z-30 -translate-x-1/2">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label={`${label} timer ${time}, expand`}
          className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium shadow-lg hover:bg-neutral-50"
        >
          <span aria-hidden>{onBreak ? "☕" : "🎯"}</span>
          <span className={`font-mono tabular-nums ${pulse}`}>{time}</span>
          <ChevronUp className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div role="timer" aria-label={`${label} timer`} className="no-print fixed bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-neutral-200 bg-white py-1.5 pl-4 pr-2 shadow-lg">
      <span className="min-w-0 max-w-64 truncate text-sm" title={state.ticketTitle ?? undefined}>
        <span aria-hidden>{onBreak ? "☕" : "🎯"}</span>{" "}
        {onBreak ? "Break time" : state.ticketKey ? `${state.ticketKey}: ${state.ticketTitle ?? ""}` : "Focus session"}
      </span>
      <span className={`font-mono text-lg font-semibold tabular-nums ${pulse} ${onBreak ? "text-emerald-600" : "text-red-600"}`}>{time}</span>
      <div className="flex items-center">
        <button
          type="button"
          onClick={state.isRunning ? pauseTimer : resumeTimer}
          aria-label={state.isRunning ? "Pause timer" : "Resume timer"}
          className="rounded-full p-1.5 text-neutral-600 hover:bg-neutral-100"
        >
          {state.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        {!onBreak && (
          <button type="button" onClick={skipToBreak} aria-label="Skip to break" title="Skip to break" className="rounded-full p-1.5 text-neutral-600 hover:bg-neutral-100">
            <Coffee className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={resetTimer} aria-label="Reset timer" title="Reset (stops the session)" className="rounded-full p-1.5 text-neutral-600 hover:bg-neutral-100">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse timer" className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
