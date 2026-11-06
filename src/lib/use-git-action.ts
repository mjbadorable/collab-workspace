"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Fired after a push or fetch finishes, so every git telemetry view on the page reads the repo again.
export const GIT_REFRESH_EVENT = "collab-workspace:git-refresh";

export type GitActionResult = { ok: boolean; message: string; timestamp: number };

type ApiReply = { ok?: boolean; error?: string };

const RESULT_VISIBLE_MS = 5000;

export function useGitAction(projectId: string) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GitActionResult | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const execute = useCallback(
    async (action: "push" | "fetch"): Promise<boolean> => {
      setRunning(true);
      let ok = false;
      let message: string;
      try {
        const res = await fetch("/api/local-git-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: projectId, action }),
        });
        const data = (await res.json()) as ApiReply;
        ok = res.ok && data.ok === true;
        message = ok ? (action === "push" ? "Pushed successfully ✓" : "Fetched from origin ✓") : (data.error ?? `${action} failed`);
      } catch {
        message = "Could not reach the local dev server";
      }
      setRunning(false);
      setResult({ ok, message, timestamp: Date.now() });
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setResult(null), RESULT_VISIBLE_MS);
      window.dispatchEvent(new Event(GIT_REFRESH_EVENT));
      return ok;
    },
    [projectId]
  );

  const pushToOrigin = useCallback(() => execute("push"), [execute]);
  const fetchOrigin = useCallback(() => execute("fetch"), [execute]);

  return { running, result, pushToOrigin, fetchOrigin };
}
