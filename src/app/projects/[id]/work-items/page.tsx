"use client";

import { Suspense, use } from "react";
import WorkItemsView from "@/components/work-items/work-items-view";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function WorkItemsContent({ params }: { params: Params }) {
  const { id } = use(params);
  return <WorkItemsView projectId={id} />;
}

export default function WorkItemsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <WorkItemsContent params={params} />
    </Suspense>
  );
}
