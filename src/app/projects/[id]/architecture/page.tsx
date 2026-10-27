"use client";

import { Suspense, use } from "react";
import ProjectArchitecture from "@/components/projects/project-architecture";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  return <ProjectArchitecture projectId={id} />;
}

export default function ProjectArchitecturePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Content params={params} />
    </Suspense>
  );
}
