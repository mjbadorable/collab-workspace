import { suggestIdentifier } from "@/lib/identifier";

const TIMEOUT_MS = 8000;
const MAX_README_CHARS = 200_000;
const MAX_ITEMS = 5;
const MAX_FUNCTIONS = 8;

// SSRF guard: the only hosts ever fetched are the two constants below. The user's input is reduced to an
// owner/repo pair that must match GitHub's naming rules before it is placed in a path.
const API_HOST = "https://api.github.com";
const RAW_HOST = "https://raw.githubusercontent.com";
const NAME_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

type Priority = "low" | "medium" | "high";
type WorkItemDraft = { title: string; priority: Priority };

const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status });

function parseRepo(input: string): { owner: string; repo: string } | null {
  let text = input.trim();
  if (!text) return null;
  if (/^[\w.-]+\/[\w.-]+$/.test(text)) text = `https://github.com/${text}`;
  else if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) return null;
  const [owner, rawRepo] = url.pathname.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/i, "");
  if (!owner || !repo || !NAME_PATTERN.test(owner) || !NAME_PATTERN.test(repo)) return null;
  return { owner, repo };
}

const stripMarkdown = (text: string) =>
  text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const stripEmoji = (text: string) => text.replace(/[\p{Extended_Pictographic}‍️]/gu, "").replace(/\s+/g, " ").trim();

const prettify = (repo: string) =>
  repo
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

function readmeName(readme: string): string | null {
  const heading = readme.match(/^#\s+(.+)$/m)?.[1];
  if (!heading) return null;
  const name = stripEmoji(stripMarkdown(heading)).replace(/\s*\(.*?\)\s*/g, " ").trim();
  return name && name.length <= 50 ? name : null;
}

function readmeDescription(readme: string): string | null {
  for (const block of readme.split(/\n\s*\n/)) {
    const first = block.trim();
    if (!first || /^(#|[-*+]\s|\d+\.\s|>|```|\||<|!\[|\[!\[)/.test(first)) continue;
    const text = stripMarkdown(first);
    if (text.length >= 20) return text.slice(0, 280);
  }
  return null;
}

const HOSTING = /https?:\/\/[\w-]+(?:\.[\w-]+)*\.(?:web\.app|vercel\.app|pages\.dev|netlify\.app|github\.io)(?:\/[^\s)"'<>\]]*)?/i;

function findLiveUrl(homepage: string | null, readme: string): string | null {
  if (homepage && /^https?:\/\//i.test(homepage)) return homepage.trim();
  const match = readme.match(HOSTING)?.[0];
  return match ? match.replace(/[.,;:]+$/, "") : null;
}

function pickIcon(text: string): string {
  const t = text.toLowerCase();
  if (/\b(mobile|android|ios|flutter|react native|expo|app store)\b/.test(t)) return "📱";
  if (/\b(grade|grading|exam|school|student|education|learning|quiz|teacher|course|academic)\b/.test(t)) return "🎓";
  if (/\b(tool|cli|devops|automation|monitor|pipeline|ci\/cd|workflow|bot)\b/.test(t)) return "⚡";
  return "💻";
}

const TABLE_RULE = /^\s*\|?[\s:|-]+\|?\s*$/; // the |---|---| line under a table header

const clip = (title: string) => (title.length > 100 ? `${title.slice(0, 97)}…` : title);

// Items under "Features" / "What it does" (capabilities) and "TODO" / "Roadmap" (open work). Bullets and the
// first cell of table rows both count. Finished roadmap rows and checked boxes ("- [x]") are skipped.
function scanSections(readme: string): { features: string[]; todos: string[] } {
  const lines = readme.split("\n");
  const features: string[] = [];
  const todos: string[] = [];
  let inSection = false;
  let sectionLevel = 0;
  let isTodo = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const level = heading[1].length;
      if (/features?|what it does|todo|to-do|roadmap/i.test(heading[2])) {
        inSection = true;
        sectionLevel = level;
        isTodo = /todo|to-do|roadmap/i.test(heading[2]);
      } else if (inSection && level <= sectionLevel) {
        inSection = false;
      }
      continue;
    }
    if (!inSection) continue;
    const target = isTodo ? todos : features;

    if (line.trimStart().startsWith("|")) {
      if (TABLE_RULE.test(line) || TABLE_RULE.test(lines[i + 1] ?? "")) continue;
      if (isTodo && /\b(done|completed?|shipped)\b/i.test(line)) continue;
      const cell = line.split("|")[1] ?? "";
      const title = stripEmoji(stripMarkdown(cell)).replace(/^\d+\.\s*/, "").replace(/[:.]+$/, "");
      if (title.length >= 3) target.push(clip(title));
      continue;
    }

    const bullet = line.match(/^\s{0,3}(?:[-*+]|\d+\.)\s+(?:\[( |x|X)\]\s+)?(.+)$/);
    if (!bullet) continue;
    if (bullet[1] && bullet[1] !== " ") continue;
    const title = stripEmoji(stripMarkdown(bullet[2])).replace(/[:.]+$/, "");
    if (title.length >= 3) target.push(clip(title));
  }
  return { features, todos };
}

function extractWorkItems(todos: string[], features: string[]): WorkItemDraft[] {
  // Open TODOs first: they are the real backlog.
  return [...todos, ...features].slice(0, MAX_ITEMS).map((title, i) => ({
    title,
    priority: i < 2 ? "high" : i < 4 ? "medium" : "low",
  }));
}

// ---------------------------------------------------------------- tech stack detection

type Tech = { pkg: string; label: string; versioned?: boolean };

const FRONTEND_DEPS: Tech[] = [
  { pkg: "next", label: "Next.js", versioned: true },
  { pkg: "react", label: "React", versioned: true },
  { pkg: "vue", label: "Vue", versioned: true },
  { pkg: "svelte", label: "Svelte", versioned: true },
  { pkg: "@angular/core", label: "Angular", versioned: true },
  { pkg: "astro", label: "Astro", versioned: true },
  { pkg: "vite", label: "Vite", versioned: true },
  { pkg: "typescript", label: "TypeScript" },
  { pkg: "tailwindcss", label: "Tailwind CSS", versioned: true },
  { pkg: "zustand", label: "Zustand" },
  { pkg: "@reduxjs/toolkit", label: "Redux Toolkit" },
  { pkg: "@tanstack/react-query", label: "TanStack Query" },
  { pkg: "@xyflow/react", label: "React Flow" },
  { pkg: "framer-motion", label: "Framer Motion" },
  { pkg: "pdfjs-dist", label: "PDF.js" },
];

const BACKEND_DEPS: Tech[] = [
  { pkg: "dexie", label: "IndexedDB (Dexie.js", versioned: true },
  { pkg: "@supabase/supabase-js", label: "Supabase" },
  { pkg: "firebase", label: "Firebase" },
  { pkg: "express", label: "Express" },
  { pkg: "fastify", label: "Fastify" },
  { pkg: "@nestjs/core", label: "NestJS" },
  { pkg: "prisma", label: "Prisma" },
  { pkg: "@prisma/client", label: "Prisma" },
  { pkg: "mongoose", label: "MongoDB (Mongoose)" },
  { pkg: "pg", label: "PostgreSQL" },
  { pkg: "drizzle-orm", label: "Drizzle ORM" },
  { pkg: "xlsx", label: "SheetJS (Excel)" },
  { pkg: "vitest", label: "Vitest" },
];

// README mentions catch stacks that have no package.json (or deps pulled from a CDN).
const README_FRONTEND: [RegExp, string][] = [
  [/\bnext\.?js\b/i, "Next.js"],
  [/\breact\b/i, "React"],
  [/\bvue\b/i, "Vue"],
  [/\bsvelte\b/i, "Svelte"],
  [/\bangular\b/i, "Angular"],
  [/\bvite\b/i, "Vite"],
  [/\btailwind/i, "Tailwind CSS"],
  [/\btypescript\b/i, "TypeScript"],
  [/\bzustand\b/i, "Zustand"],
  [/\bradix\b/i, "Radix UI"],
];
const README_BACKEND: [RegExp, string][] = [
  [/\bdexie\b/i, "IndexedDB (Dexie.js)"],
  [/\bindexeddb\b/i, "IndexedDB"],
  [/\bservice worker\b/i, "Service Worker"],
  [/\bsupabase\b/i, "Supabase"],
  [/\bfirebase\b/i, "Firebase"],
  [/\bnode\.?js\b/i, "Node.js"],
  [/\bexpress\b/i, "Express"],
  [/\bpostgres(?:ql)?\b/i, "PostgreSQL"],
  [/\bsqlite\b/i, "SQLite"],
  [/\bsheetjs\b/i, "SheetJS (Excel)"],
  [/\bvitest\b/i, "Vitest"],
];

const major = (range: string) => range.match(/\d+/)?.[0] ?? "";

function fromPackage(pkgJson: string, techs: Tech[]): string[] {
  let deps: Record<string, string> = {};
  try {
    const parsed = JSON.parse(pkgJson);
    deps = { ...parsed.dependencies, ...parsed.devDependencies };
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const t of techs) {
    const range = deps[t.pkg];
    if (!range) continue;
    const v = t.versioned ? major(range) : "";
    // Dexie's label opens a parenthesis so the version sits inside it: "IndexedDB (Dexie.js v4)".
    const label = t.label.endsWith("(Dexie.js") ? `${t.label}${v ? ` v${v}` : ""})` : v ? `${t.label} ${v}` : t.label;
    if (!found.includes(label)) found.push(label);
  }
  return found;
}

// Adds README-detected names that the package.json pass has not already covered (matched by first word).
function mergeReadme(found: string[], readme: string, patterns: [RegExp, string][]): string[] {
  const out = [...found];
  const key = (s: string) => s.toLowerCase().split(/[\s(]/)[0];
  for (const [pattern, label] of patterns) {
    if (!pattern.test(readme)) continue;
    if (out.some((existing) => key(existing) === key(label) || (key(label) === "indexeddb" && /indexeddb/i.test(existing)))) continue;
    out.push(label);
  }
  return out;
}

async function fetchWithTimeout(url: string, headers: HeadersInit) {
  return fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function fetchRaw(owner: string, repo: string, branch: string, file: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(`${RAW_HOST}/${owner}/${repo}/${encodeURIComponent(branch)}/${file}`, {
      "User-Agent": "collab-workspace",
    });
    return res.ok ? (await res.text()).slice(0, MAX_README_CHARS) : "";
  } catch {
    return ""; // a missing file is fine: the repo metadata alone still fills most of the form
  }
}

export async function GET(request: Request) {
  const parsed = parseRepo(new URL(request.url).searchParams.get("url") ?? "");
  if (!parsed) return fail("Enter a GitHub repository URL like https://github.com/owner/repo.", 400);
  const { owner, repo } = parsed;

  let meta: { name: string; description: string | null; homepage: string | null; default_branch: string; language: string | null; topics?: string[] };
  try {
    const res = await fetchWithTimeout(`${API_HOST}/repos/${owner}/${repo}`, {
      "User-Agent": "collab-workspace",
      Accept: "application/vnd.github+json",
    });
    if (res.status === 404) return fail("Repository not found, or it is private.", 404);
    if (res.status === 403 || res.status === 429) {
      return fail("GitHub rate limit reached. Try again in a few minutes, or fill the form manually.", 429);
    }
    if (!res.ok) return fail(`GitHub returned an error (${res.status}).`, 502);
    meta = await res.json();
  } catch {
    return fail("Could not reach GitHub. Check your connection and try again.", 502);
  }

  const [readme, packageJson] = await Promise.all([
    fetchRaw(owner, repo, meta.default_branch, "README.md"),
    fetchRaw(owner, repo, meta.default_branch, "package.json"),
  ]);

  const name = readmeName(readme) ?? prettify(meta.name);
  const description = meta.description?.trim() || readmeDescription(readme) || "";
  const { features, todos } = scanSections(readme);

  const frontend = mergeReadme(fromPackage(packageJson, FRONTEND_DEPS), readme, README_FRONTEND);
  const backend = mergeReadme(fromPackage(packageJson, BACKEND_DEPS), readme, README_BACKEND);

  const project = {
    name,
    identifier: suggestIdentifier(name),
    description,
    live_url: findLiveUrl(meta.homepage, readme) ?? "",
    github_url: `https://github.com/${owner}/${repo}`,
    icon: pickIcon(`${meta.name} ${name} ${description} ${(meta.topics ?? []).join(" ")}`),
    functions: features.slice(0, MAX_FUNCTIONS),
    frontend_stack: frontend.join(", "),
    backend_stack: backend.join(", "),
  };

  return Response.json({ ok: true, project, workItems: extractWorkItems(todos, features) }, {
    headers: {
      // Edge-cached for 2 minutes, then served stale while it refreshes in the background.
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
