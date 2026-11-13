"use client";

import { Suspense, use, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import ProjectHeader from "@/components/projects/project-header";
import { slugify } from "@/lib/projects";
import { useProjects } from "@/lib/projects-context";

type Params = Promise<{ id: string }>;

// The shared header sits above every page of a project. The design canvas is a full-screen editor, so it skips it.
// An unknown project renders no header: the page itself shows "Project not found".
function Frame({ params, children }: { params: Params; children: ReactNode }) {
  const { id } = use(params);
  const { projects } = useProjects();
  const pathname = usePathname();
  // The slug fallback keeps an old bookmark (e.g. /projects/collab-workspace-devops-portal) from 404ing.
  const project = projects.find((p) => p.id === id) ?? projects.find((p) => slugify(p.name) === id);
  const showHeader = project && !pathname.includes("/designs");

  return (
    // No scroll container of its own: <main> in the app shell is the single vertical scroller, and the header is sticky in it.
    <div>
      {showHeader && <ProjectHeader project={project} />}
      {children}
    </div>
  );
}

// With Cache Components, reading params must happen under a Suspense boundary.
export default function ProjectFrame({ params, children }: { params: Params; children: ReactNode }) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Frame params={params}>{children}</Frame>
    </Suspense>
  );
}
