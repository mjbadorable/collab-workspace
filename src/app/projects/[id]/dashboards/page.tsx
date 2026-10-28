"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import ProjectAnalytics from "@/components/projects/project-analytics";
import { projectIdentifier } from "@/lib/work-items-storage";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/projects" className="hover:text-neutral-900">
          Projects
        </Link>
        <span aria-hidden>›</span>
        <Link href={`/projects/${id}`} className="hover:text-neutral-900">
          {projectIdentifier(id)}
        </Link>
        <span aria-hidden>›</span>
        <span className="text-neutral-900">Dashboards</span>
      </nav>
      <h1 className="mb-4 text-xl font-semibold">Dashboards</h1>
      <ProjectAnalytics projectId={id} detailed />
    </div>
  );
}

export default function DashboardsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Content params={params} />
    </Suspense>
  );
}
