import { redirect } from "next/navigation";

// The Design Studio was removed; old links land on the projects list.
export default function DesignPage() {
  redirect("/projects");
}
