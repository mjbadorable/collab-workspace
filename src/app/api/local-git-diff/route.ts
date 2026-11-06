import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { FLEET_PATHS, isLocalhost } from "@/lib/fleet-paths";

// Read-only: git is only asked for status and diffs, and file contents are only read to describe untracked files.

const run = promisify(execFile);

const TIMEOUT_MS = 8000;
const MAX_DIFF_BYTES = 512 * 1024;
const MAX_UNTRACKED_BYTES = 512 * 1024;
const BINARY_SNIFF_BYTES = 8000;

type ChangeStatus = "modified" | "added" | "deleted" | "untracked";
type ChangedFile = { path: string; status: ChangeStatus; insertions: number; deletions: number };

// Same exclusions as the source inspector: secrets and generated folders are never described.
const BLOCKED_DIRS = new Set([".git", "node_modules", ".next", ".vercel", ".turbo"]);
const isBlockedPath = (rel: string) =>
  rel.split("/").some((part, i, parts) => {
    const lower = part.toLowerCase();
    if (i < parts.length - 1) return BLOCKED_DIRS.has(lower);
    return lower === ".env" || lower.startsWith(".env.") || lower.endsWith(".pem") || lower.endsWith(".key") || lower.endsWith(".pfx");
  });

const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status });

// Arguments go straight to git, never through a shell. null when git fails (not a repo, no HEAD yet, timeout).
async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run("git", ["--no-optional-locks", "-C", cwd, ...args], {
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}

const same = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

// The first candidate folder that is itself the root of a git work tree.
async function resolveRepoCwd(projectId: string): Promise<string | null> {
  const candidates = FLEET_PATHS[projectId];
  if (!candidates) return null;
  for (const candidate of candidates) {
    const top = await git(candidate, ["rev-parse", "--show-toplevel"]);
    if (top !== null && same(top.trim(), candidate)) return candidate;
  }
  return null;
}

// `git status --porcelain -z`: "XY path" records separated by NUL; a rename/copy is followed by its old path.
function parseStatus(out: string): { path: string; status: ChangeStatus }[] {
  const tokens = out.split("\0");
  const files: { path: string; status: ChangeStatus }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const record = tokens[i];
    if (record.length < 4) continue;
    const x = record[0];
    const y = record[1];
    const filePath = record.slice(3);
    if (x === "R" || x === "C" || y === "R" || y === "C") i++;
    const status: ChangeStatus = x === "?" ? "untracked" : x === "D" || y === "D" ? "deleted" : x === "A" ? "added" : "modified";
    files.push({ path: filePath, status });
  }
  return files;
}

// `git diff --numstat -z --no-renames`: "ins\tdel\tpath" records; binary files report "-" for both counts.
function parseNumstat(out: string): Map<string, { insertions: number; deletions: number }> {
  const stats = new Map<string, { insertions: number; deletions: number }>();
  for (const record of out.split("\0")) {
    const match = record.match(/^(\d+|-)\t(\d+|-)\t([\s\S]+)$/);
    if (!match) continue;
    stats.set(match[3], { insertions: match[1] === "-" ? 0 : Number(match[1]), deletions: match[2] === "-" ? 0 : Number(match[2]) });
  }
  return stats;
}

// Counts only hunk body lines, so a removed line that itself starts with "--" is not mistaken for a file header.
function countDiff(diff: string): { insertions: number; deletions: number } {
  let insertions = 0;
  let deletions = 0;
  let inHunk = false;
  for (const line of diff.split("\n")) {
    if (line.startsWith("@@")) inHunk = true;
    else if (line.startsWith("diff --git")) inHunk = false;
    else if (inHunk && line.startsWith("+")) insertions++;
    else if (inHunk && line.startsWith("-")) deletions++;
  }
  return { insertions, deletions };
}

type Untracked = { kind: "text"; lines: string[] } | { kind: "binary" } | { kind: "too-large" } | { kind: "missing" };

// A regular file inside the repo (never a symlink out of it), read for line counts and the synthetic diff.
async function readUntracked(root: string, rel: string): Promise<Untracked> {
  try {
    const target = path.resolve(root, rel);
    const stat = await fs.lstat(target);
    if (!stat.isFile()) return { kind: "missing" };
    if (stat.size > MAX_UNTRACKED_BYTES) return { kind: "too-large" };
    const buffer = await fs.readFile(target);
    if (buffer.subarray(0, BINARY_SNIFF_BYTES).includes(0)) return { kind: "binary" };
    const text = buffer.toString("utf8");
    if (text === "") return { kind: "text", lines: [] };
    const lines = text.split(/\r\n|\r|\n/);
    if (lines[lines.length - 1] === "") lines.pop();
    return { kind: "text", lines };
  } catch {
    return { kind: "missing" };
  }
}

function syntheticAddition(rel: string, content: Untracked): string {
  const header = [`diff --git a/${rel} b/${rel}`, "new file mode 100644"];
  if (content.kind === "binary") return [...header, `Binary file ${rel} not shown`].join("\n");
  if (content.kind === "too-large") return [...header, "File is larger than 512 KB: diff not shown"].join("\n");
  if (content.kind !== "text" || content.lines.length === 0) return header.join("\n");
  return [...header, "--- /dev/null", `+++ b/${rel}`, `@@ -0,0 +1,${content.lines.length} @@`, ...content.lines.map((l) => `+${l}`)].join("\n");
}

async function listChanges(cwd: string): Promise<ChangedFile[]> {
  const [statusOut, numstatOut] = await Promise.all([
    git(cwd, ["status", "--porcelain", "-z", "-uall"]),
    // Fails before the first commit (no HEAD); every file then just reports 0/0.
    git(cwd, ["diff", "--numstat", "-z", "--no-renames", "HEAD"]),
  ]);
  const stats = parseNumstat(numstatOut ?? "");
  const entries = parseStatus(statusOut ?? "").filter((f) => !isBlockedPath(f.path));
  return Promise.all(
    entries.map(async (f): Promise<ChangedFile> => {
      if (f.status === "untracked") {
        const content = await readUntracked(cwd, f.path);
        return { ...f, insertions: content.kind === "text" ? content.lines.length : 0, deletions: 0 };
      }
      return { ...f, ...(stats.get(f.path) ?? { insertions: 0, deletions: 0 }) };
    })
  );
}

// Rejects anything that is not a plain repo-relative path.
function cleanRelative(raw: string): string | null {
  if (raw === "" || raw.includes("\0")) return null;
  const rel = raw.replace(/\\/g, "/");
  if (path.isAbsolute(rel) || path.win32.isAbsolute(rel) || rel.startsWith("/") || /^[a-z]:/i.test(rel)) return null;
  if (rel.split("/").some((part) => part === ".." || part === "." || part === "")) return null;
  return isBlockedPath(rel) ? null : rel;
}

// ?project=<id>            -> every uncommitted file with its +/- counts
// ?project=<id>&file=<rel> -> the unified diff of one of those files
export async function GET(request: Request) {
  // Working-tree contents are only served to a browser talking to this machine directly (also keeps this handler dynamic).
  if (!isLocalhost(request.headers.get("host"))) return Response.json({ isLocal: false, files: [] });

  const params = new URL(request.url).searchParams;
  const projectId = params.get("project") ?? "collab-workspace";
  const rawFile = params.get("file");

  const cwd = await resolveRepoCwd(projectId);
  if (!cwd) return fail("Git repository not found on this machine", 404);

  const changes = await listChanges(cwd);

  if (rawFile === null) {
    return Response.json({ isLocal: true, clean: changes.length === 0, files: changes });
  }

  const rel = cleanRelative(rawFile);
  if (!rel) return fail("Access denied", 403);
  // Only files git reports as changed can be requested, so this is not a general file reader.
  const change = changes.find((c) => c.path === rel);
  if (!change) return fail("No uncommitted changes for this file", 404);

  let diff: string;
  if (change.status === "untracked") {
    diff = syntheticAddition(rel, await readUntracked(cwd, rel));
  } else {
    diff = (await git(cwd, ["diff", "HEAD", "--no-color", "--no-ext-diff", "--no-textconv", "--no-renames", "--", rel])) ?? "";
  }
  const truncated = diff.length > MAX_DIFF_BYTES;
  if (truncated) diff = diff.slice(0, MAX_DIFF_BYTES);
  const counts = change.status === "untracked" ? { insertions: change.insertions, deletions: 0 } : countDiff(diff);
  return Response.json({
    isLocal: true,
    file: rel,
    status: change.status,
    diff,
    truncated,
    insertions: truncated ? change.insertions : counts.insertions,
    deletions: truncated ? change.deletions : counts.deletions,
  });
}
