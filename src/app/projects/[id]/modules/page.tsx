"use client";

import { Suspense, use } from "react";
import ModulesView from "@/components/projects/modules-view";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  return <ModulesView projectId={id} />;
}

export default function ModulesPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Content params={params} />
    </Suspense>
  );
}
