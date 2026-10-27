import { Settings } from "lucide-react";
import PlaceholderView from "@/components/placeholder-view";

export default function SettingsPage() {
  return (
    <PlaceholderView
      title="Settings"
      description="Manage your workspace name, members and roles."
      icon={Settings}
      breadcrumbs={[{ label: "Settings" }]}
    />
  );
}
