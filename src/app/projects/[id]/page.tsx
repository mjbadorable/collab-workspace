"use client";

import { Suspense, use } from "react";
import ProjectOverview from "@/components/projects/project-overview";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  return <ProjectOverview projectId={id} />;
}

export default function ProjectOverviewPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Content params={params} />
    </Suspense>
  );
}
