"use client";

import { Suspense, use } from "react";
import SourceCodeInspector from "@/components/projects/source-code-inspector";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  return <SourceCodeInspector projectId={id} />;
}

export default function ProjectSourcePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Content params={params} />
    </Suspense>
  );
}
