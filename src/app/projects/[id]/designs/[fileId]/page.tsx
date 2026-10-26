"use client";

import { Suspense, use } from "react";
import DesignEditor from "@/components/design/design-editor";

type Params = Promise<{ id: string; fileId: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
function DesignEditorContent({ params }: { params: Params }) {
  const { id, fileId } = use(params);
  return <DesignEditor projectId={id} fileId={fileId} />;
}

export default function DesignFilePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <DesignEditorContent params={params} />
    </Suspense>
  );
}
