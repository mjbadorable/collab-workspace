import { suggestIdentifier } from "@/lib/identifier";

const TIMEOUT_MS = 8000;
const MAX_README_CHARS = 200_000;
const MAX_ITEMS = 5;

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

// Bullets under "Features", "What it does", "TODO"/"Roadmap". Checked boxes ("- [x]") are already done, so skipped.
function extractWorkItems(readme: string): WorkItemDraft[] {
  const lines = readme.split("\n");
  const titles: string[] = [];
  let inSection = false;
  let sectionLevel = 0;
  let isTodo = false;
  const todoTitles: string[] = [];

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
    // Markdown tables: the first cell is the item. Header rows (followed by |---|) and finished rows are skipped.
    if (line.trimStart().startsWith("|")) {
      if (TABLE_RULE.test(line) || TABLE_RULE.test(lines[i + 1] ?? "")) continue;
      if (/\b(done|completed?|shipped)\b/i.test(line)) continue;
      const cell = line.split("|")[1] ?? "";
      const title = stripEmoji(stripMarkdown(cell)).replace(/^\d+\.\s*/, "").replace(/[:.]+$/, "");
      if (title.length >= 3) (isTodo ? todoTitles : titles).push(title.length > 100 ? `${title.slice(0, 97)}…` : title);
      continue;
    }
    const bullet = line.match(/^\s{0,3}(?:[-*+]|\d+\.)\s+(?:\[( |x|X)\]\s+)?(.+)$/);
    if (!bullet) continue;
    if (bullet[1] && bullet[1] !== " ") continue;
    const title = stripEmoji(stripMarkdown(bullet[2])).replace(/[:.]+$/, "");
    if (title.length < 3) continue;
    (isTodo ? todoTitles : titles).push(title.length > 100 ? `${title.slice(0, 97)}…` : title);
  }

  // Open TODOs first: they are the real backlog.
  return [...todoTitles, ...titles].slice(0, MAX_ITEMS).map((title, i) => ({
    title,
    priority: i < 2 ? "high" : i < 4 ? "medium" : "low",
  }));
}

async function fetchWithTimeout(url: string, headers: HeadersInit) {
  return fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
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

  let readme = "";
  try {
    const res = await fetchWithTimeout(`${RAW_HOST}/${owner}/${repo}/${encodeURIComponent(meta.default_branch)}/README.md`, {
      "User-Agent": "collab-workspace",
    });
    if (res.ok) readme = (await res.text()).slice(0, MAX_README_CHARS);
  } catch {
    // No README is fine: the repo metadata alone still fills most of the form.
  }

  const name = readmeName(readme) ?? prettify(meta.name);
  const description = meta.description?.trim() || readmeDescription(readme) || "";
  const project = {
    name,
    identifier: suggestIdentifier(name),
    description,
    live_url: findLiveUrl(meta.homepage, readme) ?? "",
    github_url: `https://github.com/${owner}/${repo}`,
    icon: pickIcon(`${meta.name} ${name} ${description} ${(meta.topics ?? []).join(" ")}`),
  };

  return Response.json({ ok: true, project, workItems: extractWorkItems(readme) });
}
