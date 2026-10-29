import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const TIMEOUT_MS = 5000;
// The banner only ever shows a handful of entries, so long lists are clipped before they are sent.
const MAX_LIST = 20;

type LatestCommit = { shortSha: string; message: string; timeAgo: string };

type RepoStatus =
  | { isLocal: true; notFound: true; repoPath: null }
  | {
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

type GitStatusResponse = { isLocal: false } | RepoStatus | { isLocal: true; fleet: Record<string, RepoStatus> };

const CLOUD: GitStatusResponse = { isLocal: false };
const NOT_FOUND: RepoStatus = { isLocal: true, notFound: true, repoPath: null };

// The developer's fleet: project id -> folders it may live in on this machine, most likely first.
// Only these ids are ever resolved, so ?project= can never point git at an arbitrary directory.
const FLEET_PATHS: Record<string, string[]> = {
  "collab-workspace": [process.cwd()],
  "exam-reviewer-app": [
    "C:\\Users\\MarvinJhayAdorable\\Projects\\exam-reviewer-app",
    path.resolve(process.cwd(), "..", "Projects", "exam-reviewer-app"),
    path.resolve(process.cwd(), "..", "exam-reviewer-app"),
  ],
  "mastersoft-grade-encoding-assistant": [
    "C:\\Users\\MarvinJhayAdorable\\Mastersoft-Grade-Encoding-Assistant-repo",
    path.resolve(process.cwd(), "..", "Mastersoft-Grade-Encoding-Assistant-repo"),
    "C:\\Users\\MarvinJhayAdorable\\Projects\\Mastersoft-Grade-Encoding-Assistant-main",
  ],
};

const FLEET_IDS = Object.keys(FLEET_PATHS);

// Shelling out to git only makes sense on the machine the working tree lives on. A Vercel deployment
// answers { isLocal: false } and the widget shows the cloud badge instead.
function isLocalhost(host: string | null): boolean {
  if (!host) return false;
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return name === "localhost" || name === "127.0.0.1" || name === "::1" || name.endsWith(".localhost");
}

// Returns null when git itself fails (not a repo, no git on PATH, no upstream, no commits yet), so every
// caller decides what the absence of that answer means rather than the request blowing up.
async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      // Arguments go straight to git, never through a shell, so a path with spaces or quotes is safe.
      timeout: TIMEOUT_MS,
      windowsHide: true,
    });
    // Only the trailing newline goes: porcelain status lines start with a meaningful space (" M path").
    return stdout.trimEnd();
  } catch {
    return null;
  }
}

const same = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

// A folder only counts when it is itself the root of a git work tree. `rev-parse --is-inside-work-tree` is not
// enough: a plain folder that sits inside some other repo (say a downloaded zip under the home directory) also
// answers "true", and its status would really be that outer repo's.
async function isRepoRoot(dir: string): Promise<boolean> {
  if (!fs.existsSync(dir)) return false;
  const top = await git(dir, ["rev-parse", "--show-toplevel"]);
  return top !== null && same(top, dir);
}

const resolved = new Map<string, string>();

async function resolveRepoCwd(projectId: string): Promise<string | null> {
  const candidates = FLEET_PATHS[projectId];
  if (!candidates) return null;
  // A folder found once is trusted until it disappears, so the 10-second poll does not re-probe every candidate.
  const known = resolved.get(projectId);
  if (known && fs.existsSync(known)) return known;
  resolved.delete(projectId);
  for (const candidate of candidates) {
    if (await isRepoRoot(candidate)) {
      resolved.set(projectId, candidate);
      return candidate;
    }
  }
  return null;
}

const lines = (out: string | null) => (out ? out.split("\n").map((l) => l.trimEnd()).filter(Boolean) : []);

// `XY path` for a tracked change, `?? path` for an untracked file, `R  old -> new` for a rename.
function changedFile(line: string): string {
  const filePath = line.slice(3).trim();
  const renamed = filePath.split(" -> ");
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

async function repoStatus(projectId: string): Promise<RepoStatus> {
  const cwd = await resolveRepoCwd(projectId);
  if (!cwd) return NOT_FOUND;

  const [branch, unpushedOut, statusOut, latestOut] = await Promise.all([
    git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
    // With no upstream branch there is nothing to be ahead of, so this is null and the push banner stays hidden.
    git(cwd, ["log", "@{u}..HEAD", "--oneline"]),
    git(cwd, ["status", "--porcelain=v1"]),
    git(cwd, ["log", "-1", "--format=%h|%s|%cr"]),
  ]);
  if (branch === null) return NOT_FOUND;

  const unpushed = lines(unpushedOut);
  const uncommitted = lines(statusOut);
  return {
    isLocal: true,
    repoPath: cwd,
    branch,
    unpushedCount: unpushed.length,
    unpushedCommits: unpushed.slice(0, MAX_LIST),
    uncommittedCount: uncommitted.length,
    uncommittedFiles: uncommitted.slice(0, MAX_LIST).map(changedFile),
    latestCommit: parseLatest(latestOut),
    needsPush: unpushed.length > 0,
  };
}

// ?all=true            -> { isLocal: true, fleet: { [projectId]: status } } for every known repo
// ?project=<projectId> -> that one repo's status (a project outside the fleet gets notFound)
// neither              -> this workspace's own repo
export async function GET(request: Request) {
  // Reading request data also keeps this handler at request time: with Cache Components on, a GET route that
  // touches none would be prerendered at build and never see the real working tree.
  const host = request.headers.get("host");
  if (process.env.NODE_ENV === "production" && !isLocalhost(host)) return Response.json(CLOUD);

  const params = new URL(request.url).searchParams;

  if (params.get("all") === "true") {
    const entries = await Promise.all(FLEET_IDS.map(async (id) => [id, await repoStatus(id)] as const));
    return Response.json({ isLocal: true, fleet: Object.fromEntries(entries) } satisfies GitStatusResponse);
  }

  const project = params.get("project") ?? "collab-workspace";
  return Response.json(await repoStatus(project));
}
