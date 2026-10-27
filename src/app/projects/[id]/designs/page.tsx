"use client";

import { Suspense, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getProjectDesignFile } from "@/lib/design-storage";

type Params = Promise<{ id: string }>;

// Opens this project's own design file, creating a starter one the first time. Other projects' files are never shown.
function Content({ params }: { params: Params }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/projects/${id}/designs/${getProjectDesignFile(id).id}`);
  }, [id, router]);

  return <p className="px-6 py-8 text-sm text-neutral-500">Opening designs…</p>;
}

export default function ProjectDesignsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Content params={params} />
    </Suspense>
  );
}
