"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, GitBranch } from "lucide-react";

type LatestCommit = { shortSha: string; message: string; timeAgo: string };

type FoundRepo = {
  isLocal: true;
  notFound?: false;
  repoPath: string;
  branch: string;
  unpushedCount: number;
  unpushedCommits: string[];
  uncommittedCount: number;
  uncommittedFiles: string[];
  latestCommit: LatestCommit;
  needsPush: boolean;
};

type MissingRepo = { isLocal: true; notFound: true; repoPath: null };

type RepoStatus = FoundRepo | MissingRepo;

type ApiResponse = { isLocal: false } | RepoStatus | { isLocal: true; fleet: Record<string, RepoStatus> };

// The repos on the developer's machine, in tab order. ids match the project ids the route resolves.
const FLEET: { id: string; emoji: string }[] = [
  { id: "collab-workspace", emoji: "📁" },
  { id: "exam-reviewer-app", emoji: "📄" },
  { id: "mastersoft-grade-encoding-assistant", emoji: "🎓" },
];

// How often the working tree is re-read while this tab is in the foreground.
const POLL_INTERVAL_MS = 10_000;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Pastes straight into a terminal from any folder: -C points git at the repo, so no cd is needed first.
const pushCommand = (repo: FoundRepo) => `git -C "${repo.repoPath}" push origin ${repo.branch}`;

const isDirty = (repo: RepoStatus | undefined) => !!repo && !repo.notFound && (repo.needsPush || repo.uncommittedCount > 0);

function CopyPushButton({ command, urgent = true }: { command: string; urgent?: boolean }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <button
      type="button"
      title={command}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(command);
          setCopied(true);
        } catch {
          // clipboard blocked: the command is on screen to copy by hand
        }
      }}
      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium shadow-xs ${
        urgent
          ? "border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
          : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy git push"}
    </button>
  );
}

function FileList({ files, count }: { files: string[]; count: number }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-left text-xs font-medium text-neutral-700"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
        <span aria-hidden>📝</span> {plural(count, "uncommitted modified file")}
      </button>
      {open && (
        <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto border-t border-neutral-200 pt-1.5 font-mono text-[11px] text-neutral-600">
          {files.map((file) => (
            <li key={file} className="truncate" title={file}>
              {file}
            </li>
          ))}
          {count > files.length && <li className="text-neutral-400">+{count - files.length} more…</li>}
        </ul>
      )}
    </div>
  );
}

function Details({ repo }: { repo: FoundRepo }) {
  const { latestCommit } = repo;

  return (
    <div className="space-y-2">
      <p className="truncate font-mono text-[11px] text-neutral-400" title={repo.repoPath}>
        {repo.repoPath}
      </p>

      {repo.needsPush && (
        <div className="animate-pulse rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-amber-900">
              <span aria-hidden>⚡</span> {plural(repo.unpushedCount, "local commit")} need push to origin/{repo.branch}
            </p>
            <CopyPushButton command={pushCommand(repo)} />
          </div>
          <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-amber-800">
            {repo.unpushedCommits.map((commit) => (
              <li key={commit} className="truncate" title={commit}>
                {commit}
              </li>
            ))}
          </ul>
        </div>
      )}

      {repo.uncommittedCount > 0 && <FileList files={repo.uncommittedFiles} count={repo.uncommittedCount} />}

      {!repo.needsPush && repo.uncommittedCount === 0 && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <span aria-hidden>✓</span> Local git working tree clean &amp; up to date with remote
        </p>
      )}

      {latestCommit.shortSha && (
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-600">{latestCommit.shortSha}</span>
          <span className="min-w-0 flex-1 truncate" title={latestCommit.message}>
            {latestCommit.message}
          </span>
          <span className="shrink-0">{latestCommit.timeAgo}</span>
        </p>
      )}
    </div>
  );
}

const NotFoundNote = () => (
  <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
    No git repository for this project was found on this machine.
  </p>
);

function RepoHeader({ repo, name }: { repo: RepoStatus; name?: string }) {
  return (
    <>
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        {!repo.notFound && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${repo.notFound ? "bg-neutral-300" : "bg-emerald-500"}`} />
      </span>
      <span className="text-sm font-semibold">{name ?? "Local Dev Engine"}</span>
      {repo.notFound ? (
        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
          Repo not found
        </span>
      ) : (
        <>
          <span className="flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[11px] text-neutral-600">
            <GitBranch className="h-3 w-3" aria-hidden /> Branch: {repo.branch}
          </span>
          {repo.needsPush && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              {repo.unpushedCount} to push
            </span>
          )}
          {repo.uncommittedCount > 0 && (
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
              {repo.uncommittedCount} changed
            </span>
          )}
        </>
      )}
    </>
  );
}

// "All Fleet": one summary card per repo, each with its own push command.
function FleetGrid({ fleet, onPick }: { fleet: Record<string, RepoStatus>; onPick: (id: string) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {FLEET.map(({ id, emoji }) => {
        const repo = fleet[id];
        return (
          <li key={id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <button
              type="button"
              onClick={() => onPick(id)}
              className="flex items-center gap-1.5 truncate text-left text-sm font-semibold hover:text-red-600"
              title={`Show ${id} only`}
            >
              <span aria-hidden>{emoji}</span>
              <span className="truncate">{id}</span>
            </button>
            {!repo || repo.notFound ? (
              <p className="text-xs text-neutral-500">Repo not found on this machine</p>
            ) : (
              <>
                <p className="flex items-center gap-1 font-mono text-[11px] text-neutral-600">
                  <GitBranch className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{repo.branch}</span>
                </p>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-medium ${
                      repo.needsPush ? "border-amber-300 bg-amber-50 text-amber-800" : "border-neutral-200 bg-white text-neutral-500"
                    }`}
                  >
                    {repo.unpushedCount} unpushed
                  </span>
                  <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 font-medium text-neutral-600">
                    {plural(repo.uncommittedCount, "uncommitted file")}
                  </span>
                </div>
                <div className="mt-auto pt-1">
                  <CopyPushButton command={pushCommand(repo)} urgent={repo.needsPush} />
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FleetTabs({
  fleet,
  active,
  onChange,
}: {
  fleet: Record<string, RepoStatus>;
  active: string;
  onChange: (id: string) => void;
}) {
  const tab = (isActive: boolean) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
      isActive ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-600 hover:text-neutral-900"
    }`;

  return (
    <div role="tablist" aria-label="Fleet repositories" className="flex gap-1 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-100 p-1">
      <button type="button" role="tab" aria-selected={active === "all"} onClick={() => onChange("all")} className={tab(active === "all")}>
        <span aria-hidden>🚀</span> All Fleet
        {FLEET.some((f) => isDirty(fleet[f.id])) && <span className="text-amber-500" aria-label="has pending changes">●</span>}
      </button>
      {FLEET.map(({ id, emoji }) => (
        <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => onChange(id)} className={tab(active === id)}>
          <span aria-hidden>{emoji}</span> {id}
          {isDirty(fleet[id]) && <span className="text-amber-500" aria-label="has pending changes">●</span>}
        </button>
      ))}
    </div>
  );
}

// Watches the git working trees on this machine: which branch, what is still uncommitted and what has not been
// pushed yet. Polls /api/local-git-status every 10 seconds while the tab is visible; on a deployed build that
// route reports no local tree and this collapses to a cloud badge.
//
//   showFleetTabs  Home dashboard: tab bar over the whole fleet, "All Fleet" summary grid by default.
//   projectId      Project overview: that project's repo only, with its folder path and push command.
//   neither        this workspace's own repo.
//   collapsible    starts the single-repo panel folded behind its one-line summary.
export default function LocalDevWidget({
  projectId,
  showFleetTabs = false,
  collapsible = false,
}: {
  projectId?: string;
  showFleetTabs?: boolean;
  collapsible?: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expanded, setExpanded] = useState(!collapsible);
  const [active, setActive] = useState("all");
  const [tick, setTick] = useState(0);

  const url = showFleetTabs
    ? "/api/local-git-status?all=true"
    : projectId
      ? `/api/local-git-status?project=${encodeURIComponent(projectId)}`
      : "/api/local-git-status";

  // The heartbeat: a fresh read every 10 seconds, skipped while the tab is in the background, plus one
  // immediate read when the tab comes back so a commit made meanwhile shows up without waiting.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") setTick((n) => n + 1);
    }, POLL_INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && setTick((n) => n + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => {
        if (!controller.signal.aborted) setData({ isLocal: false });
      });
    return () => controller.abort();
  }, [url, tick]);

  if (data === null) return <div className="h-12 rounded-lg border border-neutral-200 bg-white" />;

  if (!data.isLocal) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-600">
        <span aria-hidden>☁️</span> Cloud Deployment (Vercel)
      </p>
    );
  }

  if ("fleet" in data) {
    const { fleet } = data;
    const repo = fleet[active];
    return (
      <section aria-label="Local dev engine" className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-semibold">Local Dev Engine</span>
          <span className="text-[11px] text-neutral-400">fleet monitor · refreshes every 10s</span>
        </div>
        <FleetTabs fleet={fleet} active={active} onChange={setActive} />
        {active === "all" || !repo ? (
          <FleetGrid fleet={fleet} onPick={setActive} />
        ) : repo.notFound ? (
          <NotFoundNote />
        ) : (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <RepoHeader repo={repo} name={active} />
            </div>
            <Details repo={repo} />
          </div>
        )}
      </section>
    );
  }

  const header = <RepoHeader repo={data} name={projectId} />;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <section aria-label="Local dev engine" className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex w-full flex-wrap items-center gap-2 text-left"
        >
          {header}
          <Chevron className="ml-auto h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">{header}</div>
      )}
      {expanded && <div className="mt-2.5">{data.notFound ? <NotFoundNote /> : <Details repo={data} />}</div>}
    </section>
  );
}
