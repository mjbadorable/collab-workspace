"use client";

import { Suspense, use } from "react";
import ProjectSettingsView from "@/components/settings/project-settings-view";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  return <ProjectSettingsView projectId={id} />;
}

export default function ProjectSettingsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Content params={params} />
    </Suspense>
  );
}
