import PokeballIcon from "@/components/pokeball-icon";
import type { ProjectRecord } from "@/lib/projects";

// "pokeball" is the icon value that renders the SVG Pokéball instead of an emoji or the name's first letter.
export const isPokeballProject = (project: Pick<ProjectRecord, "id" | "icon">) =>
  project.icon === "pokeball" || project.id === "collab-workspace";

// The project's badge: Pokéball on a dark tile, otherwise its emoji or first letter on the red/amber gradient.
// Size it with `className` (e.g. "h-12 w-12 text-xl").
export default function ProjectAvatar({
  project,
  className = "h-12 w-12 text-xl",
}: {
  project: Pick<ProjectRecord, "id" | "icon" | "name">;
  className?: string;
}) {
  const base = "flex shrink-0 items-center justify-center rounded-lg";
  if (isPokeballProject(project)) {
    return (
      <span className={`${base} bg-linear-to-br from-neutral-800 to-neutral-950 ring-1 ring-neutral-700 ${className}`}>
        <PokeballIcon className="h-[78%] w-[78%]" />
        <span className="sr-only">{project.name}</span>
      </span>
    );
  }
  return (
    <span className={`${base} bg-linear-to-br from-red-500 to-amber-400 font-semibold text-white ${className}`}>
      {project.icon ?? project.name[0]?.toUpperCase()}
    </span>
  );
}
