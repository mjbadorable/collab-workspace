"use client";

import { Suspense, use } from "react";
import { BarChart3 } from "lucide-react";
import PlaceholderView from "@/components/placeholder-view";
import { projectIdentifier } from "@/lib/work-items-storage";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  return (
    <PlaceholderView
      title="Dashboards"
      description="Project analytics and burndown charts."
      icon={BarChart3}
      breadcrumbs={[
        { label: "Projects", href: "/projects" },
        { label: projectIdentifier(id), href: `/projects/${id}/work-items` },
        { label: "Dashboards" },
      ]}
      backHref={`/projects/${id}/work-items`}
      backLabel="Back to Work items"
    />
  );
}

export default function DashboardsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Content params={params} />
    </Suspense>
  );
}
