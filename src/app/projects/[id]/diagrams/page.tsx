"use client";

import { Suspense, use } from "react";
import DiagramEditor from "@/components/diagrams/diagram-editor";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function DiagramsContent({ params }: { params: Params }) {
  const { id } = use(params);
  return <DiagramEditor projectId={id} />;
}

export default function DiagramsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <DiagramsContent params={params} />
    </Suspense>
  );
}
