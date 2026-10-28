"use client";

import { Suspense, use } from "react";
import CyclesView from "@/components/projects/cycles-view";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  return <CyclesView projectId={id} />;
}

export default function CyclesPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Content params={params} />
    </Suspense>
  );
}
