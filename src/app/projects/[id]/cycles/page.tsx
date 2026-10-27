"use client";

import { Suspense, use } from "react";
import { RefreshCw } from "lucide-react";
import PlaceholderView from "@/components/placeholder-view";
import { projectIdentifier } from "@/lib/work-items-storage";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  return (
    <PlaceholderView
      title="Cycles"
      description="Plan sprints and track progress cycle by cycle."
      icon={RefreshCw}
      breadcrumbs={[
        { label: "Projects", href: "/projects" },
        { label: projectIdentifier(id), href: `/projects/${id}/work-items` },
        { label: "Cycles" },
      ]}
      backHref={`/projects/${id}/work-items`}
      backLabel="Back to Work items"
    />
  );
}

export default function CyclesPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Content params={params} />
    </Suspense>
  );
}
