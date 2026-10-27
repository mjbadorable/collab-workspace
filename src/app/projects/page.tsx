import { Layers } from "lucide-react";
import PlaceholderView from "@/components/placeholder-view";

export default function ProjectsPage() {
  return (
    <PlaceholderView
      title="Projects"
      description="Browse, create and archive every project in your workspace."
      icon={Layers}
      breadcrumbs={[{ label: "Projects" }]}
    />
  );
}
