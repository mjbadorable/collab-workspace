"use client";

import { useEnvironment } from "@/components/environment-switcher";
import type { ProjectRecord } from "@/lib/projects";
import { healthDot, useHealth } from "./use-health";

export function EnvBadge({ label, dot, text }: { label: string; dot: string; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs font-medium ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden /> {label}
    </span>
  );
}

// The dot is the live health of the project's URL; the label is the environment currently selected in the sidebar.
function LiveEnvBadge({ url }: { url: string }) {
  const [env] = useEnvironment();
  const { health } = useHealth(url);
  const label = env === "staging" ? "Staging" : "Production";
  const text = health.state === "offline" ? "text-red-700" : health.state === "online" ? "text-emerald-700" : "text-neutral-600";
  return <EnvBadge label={label} dot={healthDot(health)} text={text} />;
}

// "Production" / "Staging" for a project with a live URL, "Development" for one without.
export default function ProjectEnvBadge({ project }: { project: Pick<ProjectRecord, "live_url"> }) {
  return project.live_url ? <LiveEnvBadge url={project.live_url} /> : <EnvBadge label="Development" dot="bg-neutral-400" text="text-neutral-600" />;
}
