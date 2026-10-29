import { execSync } from "node:child_process";

const TIMEOUT_MS = 5000;
// The banner only ever shows a handful of entries, so long lists are clipped before they are sent.
const MAX_LIST = 20;

type LatestCommit = { shortSha: string; message: string; timeAgo: string };

type LocalGitStatus =
  | { isLocal: false }
  | {
      isLocal: true;
      branch: string;
      unpushedCount: number;
      unpushedCommits: string[];
      uncommittedCount: number;
      uncommittedFiles: string[];
      latestCommit: LatestCommit;
      needsPush: boolean;
    };

const CLOUD: LocalGitStatus = { isLocal: false };

// Shelling out to git only makes sense on the machine the working tree lives on. A Vercel deployment
// answers { isLocal: false } and the widget shows the cloud badge instead.
function isLocalhost(host: string | null): boolean {
  if (!host) return false;
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return name === "localhost" || name === "127.0.0.1" || name === "::1" || name.endsWith(".localhost");
}

// Returns null when git itself fails (not a repo, no git on PATH, no upstream, no commits yet), so every
// caller decides what the absence of that answer means rather than the request blowing up.
function git(args: string): string | null {
  try {
    return execSync(`git ${args}`, {
      cwd: process.cwd(),
      encoding: "utf8",
      // stderr is swallowed: "no upstream configured" is an expected answer here, not a server error.
      stdio: ["ignore", "pipe", "ignore"],
      timeout: TIMEOUT_MS,
      windowsHide: true,
      // Only the trailing newline goes: porcelain status lines start with a meaningful space (" M path").
    }).trimEnd();
  } catch {
    return null;
  }
}

const lines = (out: string | null) => (out ? out.split("\n").map((l) => l.trimEnd()).filter(Boolean) : []);

// `XY path` for a tracked change, `?? path` for an untracked file, `R  old -> new` for a rename.
function changedFile(line: string): string {
  const path = line.slice(3).trim();
  const renamed = path.split(" -> ");
  return renamed[renamed.length - 1].replace(/^"|"$/g, "");
}

// "%h|%s|%cr" — the subject itself may contain a pipe, so the sha is cut off the front and the age off the back.
function parseLatest(out: string | null): LatestCommit {
  if (!out) return { shortSha: "", message: "No commits yet", timeAgo: "" };
  const first = out.indexOf("|");
  const last = out.lastIndexOf("|");
  if (first === -1 || last === first) return { shortSha: "", message: out, timeAgo: "" };
  return { shortSha: out.slice(0, first), message: out.slice(first + 1, last), timeAgo: out.slice(last + 1) };
}

export async function GET(request: Request) {
  // Reading a header also keeps this handler at request time: with Cache Components on, a GET route that
  // touches no runtime data would be prerendered at build and never see the real working tree.
  const host = request.headers.get("host");
  if (process.env.NODE_ENV === "production" && !isLocalhost(host)) return Response.json(CLOUD);

  const branch = git("rev-parse --abbrev-ref HEAD");
  if (branch === null) return Response.json(CLOUD);

  // With no upstream branch there is nothing to be ahead of, so the push banner stays hidden.
  const unpushed = lines(git("log @{u}..HEAD --oneline"));
  const uncommitted = lines(git("status --porcelain=v1"));

  const status: LocalGitStatus = {
    isLocal: true,
    branch,
    unpushedCount: unpushed.length,
    unpushedCommits: unpushed.slice(0, MAX_LIST),
    uncommittedCount: uncommitted.length,
    uncommittedFiles: uncommitted.slice(0, MAX_LIST).map(changedFile),
    latestCommit: parseLatest(git('log -1 --format="%h|%s|%cr"')),
    needsPush: unpushed.length > 0,
  };
  return Response.json(status);
}
