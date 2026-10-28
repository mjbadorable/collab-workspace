const TIMEOUT_MS = 8000;
const MAX_TEXT = 1500;

// SSRF guard: a request is only ever made to an https Discord or Slack webhook endpoint, and redirects are not followed.
const DISCORD_HOSTS = ["discord.com", "discordapp.com"];
const SLACK_HOST = "hooks.slack.com";

type AlertState = "online" | "offline" | "info";
type AlertBody = { webhookUrl: string; projectName: string; title: string; message: string; state?: AlertState };

const COLORS: Record<AlertState, number> = { online: 0x16a34a, offline: 0xdc2626, info: 0x2563eb };

const fail = (error: string, status = 200) => Response.json({ ok: false, error }, { status });

function isAlertBody(value: unknown): value is AlertBody {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.webhookUrl === "string" &&
    typeof b.projectName === "string" &&
    typeof b.title === "string" &&
    typeof b.message === "string" &&
    (b.state === undefined || b.state === "online" || b.state === "offline" || b.state === "info")
  );
}

function classify(raw: string): { url: URL; kind: "discord" | "slack" } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (DISCORD_HOSTS.includes(host) && url.pathname.startsWith("/api/webhooks/")) return { url, kind: "discord" };
  if (host === SLACK_HOST && url.pathname.startsWith("/services/")) return { url, kind: "slack" };
  return null;
}

const clip = (text: string) => text.slice(0, MAX_TEXT);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Send a JSON body.", 400);
  }
  if (!isAlertBody(body)) return fail("Missing webhookUrl, projectName, title or message.", 400);

  const target = classify(body.webhookUrl);
  if (!target) return fail("Only https Discord (discord.com) or Slack (hooks.slack.com) webhook URLs are allowed.", 400);

  const projectName = clip(body.projectName);
  const title = clip(body.title);
  const message = clip(body.message);
  const payload =
    target.kind === "discord"
      ? {
          username: "Collab Workspace Telemetry",
          embeds: [{ title, description: message, color: COLORS[body.state ?? "info"] }],
        }
      : { text: `*${projectName}* — *${title}*\n${message}` };

  try {
    const res = await fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return fail(`The webhook rejected the alert (${res.status}). Check the URL.`);
    return Response.json({ ok: true });
  } catch {
    return fail("Could not reach the webhook. Try again in a moment.");
  }
}
