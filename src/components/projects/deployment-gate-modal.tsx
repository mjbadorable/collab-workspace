"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, ClipboardCopy, Loader2, MinusCircle, RotateCw, TriangleAlert, X } from "lucide-react";
import { useProjects } from "@/lib/projects-context";

type GitRepo = {
  branch: string;
  unpushedCount: number;
  uncommittedCount: number;
};

type GitState = { kind: "cloud" } | { kind: "missing" } | { kind: "error" } | { kind: "found"; repo: GitRepo };

type HealthState =
  | { kind: "no-url" }
  | { kind: "error" }
  | { kind: "result"; ok: boolean; status: number; latencyMs: number };

type Snapshot = { git: GitState; health: HealthState };

type CheckStatus = "pass" | "warn" | "fail" | "skip";

type Check = { id: string; title: string; status: CheckStatus; detail: string };

const MAIN_BRANCHES = ["main", "master"];
const CLOUD_NOTICE = "Live Git telemetry available in local dev environment";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

async function readGit(projectId: string, signal: AbortSignal): Promise<GitState> {
  try {
    const res = await fetch(`/api/local-git-status?project=${encodeURIComponent(projectId)}`, { signal, cache: "no-store" });
    const data = (await res.json()) as { isLocal: boolean; notFound?: boolean } & Partial<GitRepo>;
    if (!data.isLocal) return { kind: "cloud" };
    if (data.notFound) return { kind: "missing" };
    if (typeof data.branch !== "string" || typeof data.unpushedCount !== "number" || typeof data.uncommittedCount !== "number") {
      return { kind: "error" };
    }
    return { kind: "found", repo: { branch: data.branch, unpushedCount: data.unpushedCount, uncommittedCount: data.uncommittedCount } };
  } catch {
    return { kind: "error" };
  }
}

async function readHealth(liveUrl: string | null | undefined, signal: AbortSignal): Promise<HealthState> {
  if (!liveUrl) return { kind: "no-url" };
  try {
    const res = await fetch(`/api/health-check?url=${encodeURIComponent(liveUrl)}`, { signal, cache: "no-store" });
    const data = (await res.json()) as { ok?: boolean; status?: number; latencyMs?: number };
    return { kind: "result", ok: data.ok === true, status: data.status ?? 0, latencyMs: data.latencyMs ?? 0 };
  } catch {
    return { kind: "error" };
  }
}

function evaluate({ git, health }: Snapshot): Check[] {
  const gitSkip = (detail: string) => ({ status: "skip" as const, detail });
  const unavailable = git.kind === "cloud" ? CLOUD_NOTICE : git.kind === "missing" ? "No git repository for this project was found on this machine" : "Git status could not be read";

  const tree: Omit<Check, "id" | "title"> =
    git.kind !== "found"
      ? gitSkip(unavailable)
      : git.repo.uncommittedCount === 0
        ? { status: "pass", detail: "Working tree clean" }
        : { status: "fail", detail: `${plural(git.repo.uncommittedCount, "uncommitted file")}: commit or stash before shipping` };

  const sync: Omit<Check, "id" | "title"> =
    git.kind !== "found"
      ? gitSkip(unavailable)
      : git.repo.unpushedCount === 0
        ? { status: "pass", detail: "Local branch matches its remote" }
        : { status: "fail", detail: `${plural(git.repo.unpushedCount, "commit")} not pushed to origin/${git.repo.branch}` };

  const target: Omit<Check, "id" | "title"> =
    health.kind === "no-url"
      ? gitSkip("No live URL set. Add one in project settings")
      : health.kind === "error"
        ? { status: "fail", detail: "Health check could not be reached (offline?)" }
        : health.ok
          ? { status: "pass", detail: `Online · HTTP ${health.status} · ${health.latencyMs}ms` }
          : { status: "fail", detail: health.status > 0 ? `Responded with HTTP ${health.status}` : "Production target is not responding" };

  let environment: Omit<Check, "id" | "title">;
  if (git.kind !== "found") {
    environment = gitSkip(unavailable);
  } else {
    const { branch, uncommittedCount } = git.repo;
    const onMain = MAIN_BRANCHES.includes(branch);
    const problems = [!onMain && `deploying from "${branch}", not main`, uncommittedCount > 0 && "branch has uncommitted changes"].filter(Boolean);
    environment = problems.length === 0 ? { status: "pass", detail: `On ${branch}` } : { status: "warn", detail: `Warning: ${problems.join(" and ")}` };
  }

  return [
    { id: "tree", title: "Git Working Tree", ...tree },
    { id: "sync", title: "Commit Synchronization", ...sync },
    { id: "health", title: "Production Target Health", ...target },
    { id: "env", title: "Environment Check", ...environment },
  ];
}

type Verdict = { tone: "ready" | "attention" | "blocked"; label: string; summary: string };

function verdictOf(checks: Check[]): Verdict {
  const failed = checks.filter((c) => c.status === "fail");
  const warned = checks.filter((c) => c.status === "warn");
  const skipped = checks.filter((c) => c.status === "skip");
  if (failed.length > 0) return { tone: "blocked", label: "Not ready to ship", summary: `Fix first: ${failed.map((c) => c.title).join(", ")}` };
  if (warned.length > 0) return { tone: "attention", label: "Needs attention", summary: `Review: ${warned.map((c) => c.title).join(", ")}` };
  if (skipped.length > 0) return { tone: "attention", label: "Partially verified", summary: `${plural(skipped.length, "check")} could not run` };
  return { tone: "ready", label: "🚀 Ready for Production", summary: "All pre-flight checks passed" };
}

const STATUS_ICON: Record<CheckStatus, { Icon: typeof Check; className: string; label: string }> = {
  pass: { Icon: Check, className: "bg-emerald-100 text-emerald-700", label: "Passed" },
  warn: { Icon: TriangleAlert, className: "bg-amber-100 text-amber-700", label: "Warning" },
  fail: { Icon: CircleAlert, className: "bg-red-100 text-red-700", label: "Failed" },
  skip: { Icon: MinusCircle, className: "bg-neutral-100 text-neutral-500", label: "Skipped" },
};

const TONE_CLASS: Record<Verdict["tone"], string> = {
  ready: "border-emerald-300 bg-emerald-50 text-emerald-800",
  attention: "border-amber-300 bg-amber-50 text-amber-900",
  blocked: "border-red-300 bg-red-50 text-red-800",
};

const MARK: Record<CheckStatus, string> = { pass: "[x]", warn: "[!]", fail: "[ ]", skip: "[-]" };

function checklistMarkdown(projectName: string, liveUrl: string | null | undefined, checks: Check[], verdict: Verdict): string {
  return [
    `# Deployment Checklist — ${projectName}`,
    "",
    `- **Date:** ${new Date().toISOString()}`,
    `- **Target:** ${liveUrl || "No live URL"}`,
    `- **Verdict:** ${verdict.label.replace("🚀 ", "")} — ${verdict.summary}`,
    "",
    ...checks.map((c) => `- ${MARK[c.status]} **${c.title}** — ${c.detail}`),
    "",
    "_[x] passed · [!] warning · [ ] failed · [-] skipped_",
  ].join("\n");
}

function GateDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { projects } = useProjects();
  const project = projects.find((p) => p.id === projectId);
  const liveUrl = project?.live_url;
  const ref = useRef<HTMLDialogElement>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [run, setRun] = useState(0);
  const [copied, setCopied] = useState(false);

  // Native <dialog> gives focus trapping, Esc-to-close and an inert page behind it.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([readGit(projectId, controller.signal), readHealth(liveUrl, controller.signal)]).then(([git, health]) => {
      if (!controller.signal.aborted) setSnapshot({ git, health });
    });
    return () => controller.abort();
  }, [projectId, liveUrl, run]);

  const checks = snapshot ? evaluate(snapshot) : null;
  const verdict = checks ? verdictOf(checks) : null;

  const copyChecklist = async () => {
    if (!checks || !verdict) return;
    try {
      await navigator.clipboard.writeText(checklistMarkdown(project?.name ?? projectId, liveUrl, checks, verdict));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: nothing to confirm.
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()}
      aria-label="Deployment gate"
      className="m-auto w-full max-w-lg rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">🚦 Deployment Gate</h2>
          <p className="text-xs text-neutral-500">{project?.name ?? projectId} · pre-flight inspection</p>
        </div>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        {verdict ? (
          <div role="status" className={`rounded-lg border px-4 py-3 ${TONE_CLASS[verdict.tone]}`}>
            <p className="text-sm font-semibold">{verdict.label}</p>
            <p className="text-xs">{verdict.summary}</p>
          </div>
        ) : (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Running pre-flight checks…
          </div>
        )}

        {snapshot?.git.kind === "cloud" && (
          <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            <span aria-hidden>☁️</span> {CLOUD_NOTICE}
          </p>
        )}

        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {(checks ?? [null, null, null, null]).map((check, i) => {
            if (!check) {
              return (
                <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-300" aria-hidden />
                  <span className="h-3 w-40 animate-pulse rounded bg-neutral-100" />
                </li>
              );
            }
            const { Icon, className, label } = STATUS_ICON[check.status];
            return (
              <li key={check.id} className="flex items-start gap-3 px-3 py-2.5">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${className}`}>
                  <Icon className="h-3 w-3" aria-hidden />
                  <span className="sr-only">{label}</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-neutral-900">{check.title}</span>
                  <span className="block text-xs text-neutral-500">{check.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-3">
        <button
          type="button"
          onClick={() => {
            setSnapshot(null);
            setRun((n) => n + 1);
          }}
          className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden /> Re-run
        </button>
        <button
          type="button"
          onClick={copyChecklist}
          disabled={!checks}
          className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy Deployment Checklist"}
        </button>
      </div>
    </dialog>
  );
}

// Pre-flight inspection before shipping: git state, sync with the remote, the live target's health and the branch.
// The dialog mounts only while open, so each opening starts from a fresh run.
export default function DeploymentGateModal({ projectId, open, onClose }: { projectId: string; open: boolean; onClose: () => void }) {
  return open ? <GateDialog projectId={projectId} onClose={onClose} /> : null;
}
