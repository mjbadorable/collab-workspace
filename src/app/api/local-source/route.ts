import fs from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { FLEET_PATHS, isLocalhost } from "@/lib/fleet-paths";

// Read-only: this handler only ever lists directories and reads files. It never writes, never spawns a process.

const MAX_FILE_BYTES = 512 * 1024;
const MAX_ENTRIES = 500;
const BINARY_SNIFF_BYTES = 8000;

// Names that are never listed or read, even inside the project root: secrets and bulky generated folders.
const BLOCKED_DIRS = new Set([".git", "node_modules", ".next", ".vercel", ".turbo"]);
const isBlockedName = (name: string, isDir: boolean) => {
  const lower = name.toLowerCase();
  if (isDir) return BLOCKED_DIRS.has(lower);
  return lower === ".env" || lower.startsWith(".env.") || lower.endsWith(".pem") || lower.endsWith(".key") || lower.endsWith(".pfx");
};

type Entry = { name: string; path: string; type: "dir" | "file"; size: number };

const denied = () => Response.json({ ok: false, error: "Access denied" }, { status: 403 });
const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status });

const isDirectory = (p: string) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

function projectRoot(projectId: string): string | null {
  const candidates = FLEET_PATHS[projectId];
  if (!candidates) return null;
  return candidates.find((c) => existsSync(c) && isDirectory(c)) ?? null;
}

const norm = (p: string) => (process.platform === "win32" ? p.toLowerCase() : p);

function isInside(root: string, target: string): boolean {
  const r = norm(root);
  const t = norm(target);
  return t === r || t.startsWith(r.endsWith(path.sep) ? r : r + path.sep);
}

// ?project=<id>&path=<relative path, "" for the root>
export async function GET(request: Request) {
  // Source code is only served to a browser talking to this machine directly (also keeps this handler dynamic).
  if (!isLocalhost(request.headers.get("host"))) return Response.json({ isLocal: false, files: [] });

  const params = new URL(request.url).searchParams;
  const projectId = params.get("project") ?? "collab-workspace";
  const rel = params.get("path") ?? "";

  const root = projectRoot(projectId);
  if (!root) return fail("Project folder not found on this machine", 404);
  if (rel.includes("\0") || path.isAbsolute(rel)) return denied();

  let realRoot: string;
  let target: string;
  try {
    realRoot = await fs.realpath(/*turbopackIgnore: true*/ root);
    const joined = path.resolve(realRoot, rel);
    if (!isInside(realRoot, joined)) return denied();
    // realpath follows symlinks, so a link inside the repo cannot lead out of it.
    target = await fs.realpath(/*turbopackIgnore: true*/ joined);
  } catch {
    return fail("Not found", 404);
  }
  if (!isInside(realRoot, target)) return denied();

  const relative = path.relative(realRoot, target).split(path.sep).filter(Boolean);
  const stat = await fs.stat(target);
  if (relative.some((part, i) => isBlockedName(part, i < relative.length - 1 || stat.isDirectory()))) return denied();
  const relPath = relative.join("/");

  if (stat.isDirectory()) {
    const dirents = await fs.readdir(target, { withFileTypes: true });
    const files: Entry[] = [];
    for (const d of dirents) {
      const isDir = d.isDirectory();
      if (!isDir && !d.isFile()) continue; // symlinks and devices are never followed from a listing
      if (isBlockedName(d.name, isDir)) continue;
      let size = 0;
      if (!isDir) size = (await fs.stat(path.join(target, d.name))).size;
      files.push({ name: d.name, path: relPath ? `${relPath}/${d.name}` : d.name, type: isDir ? "dir" : "file", size });
    }
    files.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
    return Response.json({
      ok: true,
      isLocal: true,
      type: "dir",
      path: relPath,
      files: files.slice(0, MAX_ENTRIES),
      truncated: files.length > MAX_ENTRIES,
    });
  }

  if (!stat.isFile()) return denied();
  if (stat.size > MAX_FILE_BYTES) {
    return Response.json({ ok: true, isLocal: true, type: "file", path: relPath, size: stat.size, content: null, reason: "too-large" });
  }
  const buffer = await fs.readFile(target);
  if (buffer.subarray(0, BINARY_SNIFF_BYTES).includes(0)) {
    return Response.json({ ok: true, isLocal: true, type: "file", path: relPath, size: stat.size, content: null, reason: "binary" });
  }
  const content = buffer.toString("utf8");
  return Response.json({
    ok: true,
    isLocal: true,
    type: "file",
    path: relPath,
    size: stat.size,
    lines: content.split(/\r\n|\r|\n/).length,
    content,
  });
}
