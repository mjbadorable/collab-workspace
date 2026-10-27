"use client";

import { Suspense, use } from "react";
import { Settings } from "lucide-react";
import PlaceholderView from "@/components/placeholder-view";
import { projectIdentifier } from "@/lib/work-items-storage";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  return (
    <PlaceholderView
      title="Project settings"
      description="Configure the project name, identifier and members."
      icon={Settings}
      breadcrumbs={[
        { label: "Projects", href: "/projects" },
        { label: projectIdentifier(id), href: `/projects/${id}/work-items` },
        { label: "Settings" },
      ]}
      backHref={`/projects/${id}/work-items`}
      backLabel="Back to Work items"
    />
  );
}

export default function ProjectSettingsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Content params={params} />
    </Suspense>
  );
}
