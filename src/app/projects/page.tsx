import ProjectsHub from "@/components/home/projects-hub";

// Rendered on the client once the auth gate has checked the session, so this page is not expected to navigate instantly.
export const instant = false;

export default function ProjectsPage() {
  return <ProjectsHub />;
}
