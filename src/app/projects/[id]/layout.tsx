import type { ReactNode } from "react";
import ProjectFrame from "@/components/projects/project-frame";

// The project pages render on the client after the auth gate has checked the session, so their navigations are
// not expected to be instant: opt the segment out of Next.js's instant-navigation validation (dev-only insight).
export const instant = false;

export default function ProjectLayout({ params, children }: { params: Promise<{ id: string }>; children: ReactNode }) {
  return <ProjectFrame params={params}>{children}</ProjectFrame>;
}
