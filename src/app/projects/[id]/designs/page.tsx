import { redirect } from "next/navigation";

// The sidebar's "Designs" link; design files from every project are listed in the hub.
export default function ProjectDesignsPage() {
  redirect("/design");
}
