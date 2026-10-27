import { Suspense } from "react";
import { redirect } from "next/navigation";

type Params = Promise<{ id: string }>;

// With Cache Components, reading params must happen under a Suspense boundary.
async function Redirect({ params }: { params: Params }): Promise<never> {
  const { id } = await params;
  redirect(`/projects/${id}/diagrams`);
}

// The Design Studio was removed; old links land on the project's flowcharts.
export default function ProjectDesignsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-full w-full" />}>
      <Redirect params={params} />
    </Suspense>
  );
}
