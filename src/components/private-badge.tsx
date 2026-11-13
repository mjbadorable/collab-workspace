import { Lock } from "lucide-react";
import type { ProjectRecord } from "@/lib/projects";

// Shown beside a project's identifier whenever it is private (for example a private GitHub repository).
export default function PrivateBadge({ project }: { project: Pick<ProjectRecord, "is_public"> }) {
  if (project.is_public !== false) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
      <Lock className="h-3 w-3" aria-hidden /> Private
    </span>
  );
}
