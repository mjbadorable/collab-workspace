// Client side of the webhook alerts: where a project's webhook URL is stored and how an alert is sent.
export type AlertState = "online" | "offline" | "info";

const key = (projectId: string) => `collab-workspace:webhook:${projectId}`;

export function getWebhookUrl(projectId: string): string {
  try {
    return localStorage.getItem(key(projectId)) ?? "";
  } catch {
    return "";
  }
}

export function setWebhookUrl(projectId: string, url: string): void {
  try {
    if (url) localStorage.setItem(key(projectId), url);
    else localStorage.removeItem(key(projectId));
  } catch {
    // storage blocked: the webhook just won't persist
  }
}

// Resolves to an error message, or null when the alert was delivered.
export async function sendWebhookAlert(alert: {
  webhookUrl: string;
  projectName: string;
  title: string;
  message: string;
  state?: AlertState;
}): Promise<string | null> {
  try {
    const res = await fetch("/api/webhook-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    return data.ok ? null : (data.error ?? "The alert could not be delivered.");
  } catch {
    return "Could not reach the server. Check your connection and try again.";
  }
}
