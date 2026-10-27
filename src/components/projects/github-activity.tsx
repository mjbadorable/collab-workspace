"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CircleDot, GitBranch, GitFork, Star } from "lucide-react";

type Commit = {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorAvatar: string | null;
  date: string;
  commitUrl: string;
};

type Activity = { defaultBranch: string; stars: number; forks: number; openIssues: number; commits: Commit[] };

type Result = { url: string; activity: Activity | null; error: string | null };

type ApiResponse =
  | { ok: true; repo: { defaultBranch: string; stars: number; forks: number; openIssues: number }; commits: Commit[] }
  | { ok: false; error: string };

const card = "rounded-lg border border-neutral-200 bg-white shadow-sm";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function Avatar({ commit }: { commit: Commit }) {
  const initials = commit.authorName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return commit.authorAvatar ? (
    // eslint-disable-next-line @next/next/no-img-element -- small remote GitHub avatar, no optimizer config needed
    <img src={commit.authorAvatar} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full bg-neutral-100" />
  ) : (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-600"
    >
      {initials || "?"}
    </span>
  );
}

export default function GithubActivity({ githubUrl }: { githubUrl: string | null }) {
  const url = githubUrl?.trim() || null;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(`/api/github-activity?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then((res) => res.json() as Promise<ApiResponse>)
      .then((data) => {
        if (data.ok) setResult({ url, activity: { ...data.repo, commits: data.commits }, error: null });
        else setResult({ url, activity: null, error: data.error });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({ url, activity: null, error: "Could not load GitHub activity." });
      });
    return () => controller.abort();
  }, [url]);

  if (!url) {
    return (
      <section aria-label="Live Repository Activity" className={`${card} p-4`}>
        <p className="text-sm text-neutral-500">
          No GitHub repository linked yet. Connect a repository in Project Settings to stream live commits.
        </p>
      </section>
    );
  }

  const current = result?.url === url ? result : null;

  if (!current) {
    return (
      <section aria-label="Live Repository Activity" aria-busy="true" className={`${card} divide-y divide-neutral-100`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 p-3">
            <div className="h-7 w-7 rounded-full bg-neutral-200" />
            <div className="h-3 flex-1 rounded bg-neutral-200" />
            <div className="h-5 w-16 rounded bg-neutral-200" />
          </div>
        ))}
      </section>
    );
  }

  if (!current.activity) {
    return (
      <section aria-label="Live Repository Activity" className={`${card} flex flex-wrap items-center gap-2 p-4 text-sm`}>
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <span className="text-neutral-600">{current.error}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-red-600 hover:underline">
          View on GitHub ↗
        </a>
      </section>
    );
  }

  const { defaultBranch, stars, forks, openIssues, commits } = current.activity;

  return (
    <section aria-labelledby="ov-github" className={card}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-neutral-100 px-4 py-3">
        <GitFork className="h-4 w-4 text-neutral-700" aria-hidden />
        <h2 id="ov-github" className="text-sm font-semibold text-neutral-700">
          Live Repository Activity
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-xs text-neutral-600">
          <GitBranch className="h-3 w-3" aria-hidden /> {defaultBranch}
        </span>
        <span className="ml-auto flex items-center gap-3 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1" title={`${forks} forks`}>
            <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden /> {stars}
            <span className="sr-only">stars</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-green-700">
            <CircleDot className="h-3 w-3" aria-hidden /> {openIssues} open
          </span>
        </span>
      </header>
      {commits.length > 0 ? (
        <ul className="divide-y divide-neutral-100">
          {commits.map((c) => (
            <li key={c.sha} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar commit={c} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-800" title={c.message}>
                  {c.message}
                </p>
                <p className="text-xs text-neutral-500">
                  {c.authorName} · {timeAgo(c.date)}
                </p>
              </div>
              <a
                href={c.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs text-red-600 hover:bg-neutral-200"
              >
                #{c.shortSha}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-neutral-500">No commits yet.</p>
      )}
    </section>
  );
}
