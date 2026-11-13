import HomeDashboard from "@/components/home/home-dashboard";

// Rendered on the client once the auth gate has checked the session, so this page is not expected to navigate instantly.
export const instant = false;

export default function HomePage() {
  return <HomeDashboard />;
}
