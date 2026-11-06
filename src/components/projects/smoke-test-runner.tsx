"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ClipboardCopy, Loader2, MinusCircle, Play, RotateCw, X } from "lucide-react";
import { getSentinelEvents, SENTINEL_IGNORE_HEADER } from "@/lib/error-sentinel";
import { useProjects } from "@/lib/projects-context";

type Outcome = { status: "pass" | "fail" | "skip"; detail: string };
type Result = Outcome & { latencyMs: number | null };
type Probe = { httpStatus: number; body: Record<string, unknown> | null; latencyMs: number };

type SmokeTest = {
  id: string;
  name: string;
  route: (projectId: string, liveUrl: string | null | undefined) => string;
  run: (ctx: { projectId: string; liveUrl: string | null | undefined; signal: AbortSignal }) => Promise<Outcome & { latencyMs?: number }>;
};

const LOCAL_NOTICE = "Live Git telemetry available in local dev environment";

// A probe tells the sentinel not to log the failures it provokes on purpose. null = the request itself failed.
async function probe(url: string, signal: AbortSignal): Promise<Probe | null> {
  const started = performance.now();
  try {
    const res = await fetch(url, { signal, cache: "no-store", headers: { [SENTINEL_IGNORE_HEADER]: "1" } });
    const latencyMs = Math.round(performance.now() - started);
    let body: Record<string, unknown> | null = null;
    try {
      const json: unknown = await res.json();
      if (typeof json === "object" && json !== null) body = json as Record<string, unknown>;
    } catch {
      // not JSON: body stays null
    }
    return { httpStatus: res.status, body, latencyMs };
  } catch {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    return null;
  }
}

const unreachable: Outcome = { status: "fail", detail: "Request failed (offline or server down)" };

// The three local endpoints answer { isLocal: false } on a deployed build.
function localOutcome(p: Probe | null, onOk: (p: Probe) => Outcome): Outcome & { latencyMs?: number } {
  if (!p) return unreachable;
  if (p.body?.isLocal === false) return { status: "skip", detail: LOCAL_NOTICE, latencyMs: p.latencyMs };
  if (p.httpStatus === 404) return { status: "skip", detail: "No local folder or repo for this project", latencyMs: p.latencyMs };
  return { ...onOk(p), latencyMs: p.latencyMs };
}

const TESTS: SmokeTest[] = [
  {
    id: "health",
    name: "Target Health",
    route: (_id, liveUrl) => `/api/health-check?url=${liveUrl ? encodeURIComponent(liveUrl) : "<live_url>"}`,
    run: async ({ liveUrl, signal }) => {
      if (!liveUrl) return { status: "skip", detail: "No live URL set in project settings" };
      const p = await probe(`/api/health-check?url=${encodeURIComponent(liveUrl)}`, signal);
      if (!p) return unreachable;
      const ok = p.body?.ok === true;
      return { status: ok ? "pass" : "fail", detail: ok ? `Online · HTTP ${String(p.body?.status)}` : "Target did not answer healthy", latencyMs: p.latencyMs };
    },
  },
  {
    id: "git-status",
    name: "Local Git Status Telemetry",
    route: (id) => `/api/local-git-status?project=${id}`,
    run: async ({ projectId, signal }) =>
      localOutcome(await probe(`/api/local-git-status?project=${encodeURIComponent(projectId)}`, signal), (p) =>
        p.body?.notFound === true
          ? { status: "skip", detail: "No git repository found for this project" }
          : typeof p.body?.branch === "string"
            ? { status: "pass", detail: `Branch ${p.body.branch}` }
            : { status: "fail", detail: "Unexpected response shape" }
      ),
  },
  {
    id: "git-diff",
    name: "Local Git Diff Engine",
    route: (id) => `/api/local-git-diff?project=${id}`,
    run: async ({ projectId, signal }) =>
      localOutcome(await probe(`/api/local-git-diff?project=${encodeURIComponent(projectId)}`, signal), (p) =>
        Array.isArray(p.body?.files) ? { status: "pass", detail: `${p.body.files.length} changed file(s) listed` } : { status: "fail", detail: "Unexpected response shape" }
      ),
  },
  {
    id: "source",
    name: "Local Source Tree",
    route: (id) => `/api/local-source?project=${id}`,
    run: async ({ projectId, signal }) =>
      localOutcome(await probe(`/api/local-source?project=${encodeURIComponent(projectId)}`, signal), (p) =>
        p.body?.ok === true && Array.isArray(p.body.files) ? { status: "pass", detail: `${p.body.files.length} root entries` } : { status: "fail", detail: "Source tree could not be listed" }
      ),
  },
  {
    id: "handoff",
    name: "Device Handoff API",
    route: () => "/api/device-handoff",
    // A malformed code makes the route answer 400 straight away without touching the vault or the rate limiter.
    run: async ({ signal }) => {
      const p = await probe("/api/device-handoff?code=SMOKE", signal);
      if (!p) return unreachable;
      const alive = p.httpStatus < 500 && p.body !== null;
      return { status: alive ? "pass" : "fail", detail: alive ? `Route answering (HTTP ${p.httpStatus})` : `HTTP ${p.httpStatus}`, latencyMs: p.latencyMs };
    },
  },
  {
    id: "sentinel",
    name: "Client Error Sentinel",
    route: () => "window (this session)",
    run: async () => {
      const events = getSentinelEvents();
      return events.length === 0
        ? { status: "pass", detail: "No unhandled errors this session" }
        : { status: "fail", detail: `${events.length} issue(s) logged, latest: ${events[0].message}` };
    },
  },
];

const BADGE: Record<Result["status"], { label: string; className: string }> = {
  pass: { label: "Pass", className: "bg-emerald-100 text-emerald-700" },
  fail: { label: "Fail", className: "bg-red-100 text-red-700" },
  skip: { label: "Skipped", className: "bg-neutral-100 text-neutral-500" },
};

const MARK = { pass: "[x]", fail: "[ ]", skip: "[-]" } as const;

function reportMarkdown(projectName: string, branchTarget: string, results: Record<string, Result>, finishedAt: string, verdict: string): string {
  return [
    `# Staging QA Report — ${projectName}`,
    "",
    `- **Date:** ${finishedAt}`,
    `- **Target:** ${branchTarget}`,
    `- **Verdict:** ${verdict}`,
    "",
    ...TESTS.map((t) => {
      const r = results[t.id];
      return `- ${MARK[r.status]} **${t.name}** — ${r.detail}${r.latencyMs !== null ? ` (${r.latencyMs}ms)` : ""}`;
    }),
    "",
    "_[x] pass · [ ] fail · [-] skipped_",
  ].join("\n");
}

// Six quick checks that the pieces staging depends on are alive. Runs only when asked, and can be re-run.
export default function SmokeTestRunner({ projectId }: { projectId: string }) {
  const { projects } = useProjects();
  const project = projects.find((p) => p.id === projectId);
  const liveUrl = project?.live_url;

  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState(false);
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const run = async () => {
    controller.current?.abort();
    const ctl = new AbortController();
    controller.current = ctl;
    setResults({});
    setFinishedAt(null);
    setCopied(false);
    setRunning(true);
    try {
      for (const test of TESTS) {
        const outcome = await test.run({ projectId, liveUrl, signal: ctl.signal });
        setResults((r) => ({ ...r, [test.id]: { status: outcome.status, detail: outcome.detail, latencyMs: outcome.latencyMs ?? null } }));
      }
      setFinishedAt(new Date().toISOString());
    } catch {
      // Aborted by a newer run or by leaving the page: that run owns the state now.
      if (ctl.signal.aborted) return;
    }
    setRunning(false);
  };

  const done = Object.keys(results).length;
  const all = TESTS.map((t) => results[t.id]);
  const finished = finishedAt !== null && all.every(Boolean);
  const failed = all.filter((r) => r?.status === "fail").length;
  const skipped = all.filter((r) => r?.status === "skip").length;
  const certified = finished && failed === 0 && skipped === 0;
  const verdict = !finished ? "" : failed > 0 ? `${failed} test(s) failed` : skipped > 0 ? `Partially verified (${skipped} skipped)` : "Staging Build Certified";

  const copyReport = async () => {
    if (!finished || !finishedAt) return;
    try {
      await navigator.clipboard.writeText(reportMarkdown(project?.name ?? projectId, "localhost (staging)", results as Record<string, Result>, finishedAt, verdict));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: nothing to confirm.
    }
  };

  return (
    <section aria-labelledby="ov-smoke" className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-xs">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="ov-smoke" className="text-sm font-semibold text-neutral-800">
            🧪 Staging Smoke Tests
          </h2>
          <p className="text-xs text-neutral-500">Six automated checks against the local and target endpoints.</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : done > 0 ? <RotateCw className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          {running ? "Running…" : done > 0 ? "Run again" : "Run Smoke Tests"}
        </button>
      </div>

      <div
        role="progressbar"
        aria-label="Smoke test progress"
        aria-valuemin={0}
        aria-valuemax={TESTS.length}
        aria-valuenow={done}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-100"
      >
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(done / TESTS.length) * 100}%` }} />
      </div>

      {finished && (
        <div
          role="status"
          className={`mt-3 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${
            certified ? "border-emerald-300 bg-emerald-50 text-emerald-800" : failed > 0 ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{certified ? "🧪 Staging Build Certified" : verdict}</p>
            <p className="text-xs">{new Date(finishedAt).toLocaleString()}</p>
            {skipped > 0 && failed === 0 && <p className="text-xs">{LOCAL_NOTICE}</p>}
          </div>
          <button
            type="button"
            onClick={copyReport}
            className="flex items-center gap-1.5 rounded-md border border-current/30 bg-white px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />}
            {copied ? "Copied" : "Copy Staging QA Report"}
          </button>
        </div>
      )}

      <ul className="mt-3 divide-y divide-amber-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {TESTS.map((test) => {
          const r = results[test.id];
          const isRunning = running && !r && done === TESTS.findIndex((t) => t.id === test.id);
          return (
            <li key={test.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-neutral-900">{test.name}</span>
                <span className="block truncate font-mono text-[11px] text-neutral-400" title={test.route(projectId, liveUrl)}>
                  {test.route(projectId, liveUrl)}
                </span>
                {r && <span className="block text-xs text-neutral-500">{r.detail}</span>}
              </span>
              <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-neutral-500">{r?.latencyMs != null ? `${r.latencyMs}ms` : "—"}</span>
              {r ? (
                <span className={`flex w-20 shrink-0 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[r.status].className}`}>
                  {r.status === "pass" ? <Check className="h-3 w-3" aria-hidden /> : r.status === "fail" ? <X className="h-3 w-3" aria-hidden /> : <MinusCircle className="h-3 w-3" aria-hidden />}
                  {BADGE[r.status].label}
                </span>
              ) : (
                <span className="flex w-20 shrink-0 items-center justify-center rounded-full bg-neutral-50 px-2 py-0.5 text-xs text-neutral-400">
                  {isRunning ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : "Pending"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
