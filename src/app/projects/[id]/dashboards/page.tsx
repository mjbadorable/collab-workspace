"use client";

import { Suspense, use } from "react";
import ProjectAnalytics from "@/components/projects/project-analytics";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <h1 className="text-xl font-semibold">Analytics</h1>
      <p className="mb-4 mt-1 text-sm text-neutral-500">Status, priority, velocity, cycle and module progress, and engineering hygiene for this project.</p>
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
