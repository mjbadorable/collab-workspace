import { redirect } from "next/navigation";

// The Design Studio was removed; old links land on the projects list.
// Rendered on the client once the auth gate has checked the session, so this page is not expected to navigate instantly.
export const instant = false;

export default function DesignPage() {
  redirect("/projects");
}
