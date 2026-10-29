const TIMEOUT_MS = 8000;
const COMMIT_COUNT = 5;

// SSRF guard: the only host ever fetched is API_HOST. The input is reduced to an owner/repo pair that must
// match GitHub's naming rules before it is placed in a path.
const API_HOST = "https://api.github.com";
const NAME_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

type RepoResponse = {
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  homepage: string | null;
};
type PullResponse = {
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  user: { login: string; avatar_url: string } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
};
type CommitResponse = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: { avatar_url: string } | null;
};

// Handled failures answer 200 with ok:false so the widget can show an inline notice instead of an error page.
const fail = (error: string, status = 200) => Response.json({ ok: false, error }, { status });

function parseRepo(input: string): { owner: string; repo: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) return null;
  const [owner, rawRepo] = url.pathname.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/i, "");
  if (!owner || !repo || !NAME_PATTERN.test(owner) || !NAME_PATTERN.test(repo)) return null;
  return { owner, repo };
}

const github = (path: string) =>
  fetch(`${API_HOST}${path}`, {
    headers: { "User-Agent": "collab-workspace", Accept: "application/vnd.github+json" },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

const statusError = (status: number) =>
  status === 404
    ? "Repository not found, or it is private."
    : status === 403 || status === 429
      ? "GitHub rate limit reached. Try again in a few minutes."
      : `GitHub returned an error (${status}).`;

export async function GET(request: Request) {
  const parsed = parseRepo(new URL(request.url).searchParams.get("url") ?? "");
  if (!parsed) return fail("Not a valid GitHub repository URL.", 400);
  const { owner, repo } = parsed;

  try {
    const [repoRes, commitsRes, pullsRes] = await Promise.all([
      github(`/repos/${owner}/${repo}`),
      github(`/repos/${owner}/${repo}/commits?per_page=${COMMIT_COUNT}`),
      // Pull requests are a bonus: if they fail, the rest of the widget still works.
      github(`/repos/${owner}/${repo}/pulls?state=all&per_page=${COMMIT_COUNT}`).catch(() => null),
    ]);
    if (!repoRes.ok) return fail(statusError(repoRes.status));
    if (!commitsRes.ok) return fail(statusError(commitsRes.status));

    const meta = (await repoRes.json()) as RepoResponse;
    const commits = (await commitsRes.json()) as CommitResponse[];
    let pulls: PullResponse[] = [];
    try {
      if (pullsRes?.ok) pulls = (await pullsRes.json()) as PullResponse[];
    } catch {
      pulls = [];
    }

    return Response.json({
      ok: true,
      repo: {
        defaultBranch: meta.default_branch,
        stars: meta.stargazers_count,
        forks: meta.forks_count,
        openIssues: meta.open_issues_count,
        homepage: meta.homepage || null,
      },
      pulls: pulls.slice(0, COMMIT_COUNT).map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.merged_at ? "merged" : pr.state === "open" ? "open" : "closed",
        authorName: pr.user?.login ?? "Unknown",
        authorAvatar: pr.user?.avatar_url ?? null,
        date: pr.updated_at || pr.created_at,
        prUrl: pr.html_url,
      })),
      commits: commits.slice(0, COMMIT_COUNT).map((c) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message.split("\n")[0],
        authorName: c.commit.author?.name ?? "Unknown",
        authorAvatar: c.author?.avatar_url ?? null,
        date: c.commit.author?.date ?? "",
        commitUrl: c.html_url,
      })),
    }, {
      headers: {
        // Edge-cached for 2 minutes, then served stale while it refreshes in the background.
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch {
    return fail("Could not reach GitHub. Check your connection and try again.");
  }
}
