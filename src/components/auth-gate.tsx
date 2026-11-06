"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useIsClient } from "@/lib/use-is-client";
import PokeballIcon from "./pokeball-icon";

const PUBLIC_ROUTES = ["/login"];
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

// Local development keeps the offline "Local Preview Mode"; anywhere else a signed-out visitor is sent to /login.
export function isLocalHost(): boolean {
  return typeof window !== "undefined" && LOCAL_HOSTS.includes(window.location.hostname);
}

function Splash({ label }: { label: string }) {
  return (
    <div role="status" className="flex h-screen items-center justify-center bg-neutral-900 text-white">
      <div className="flex flex-col items-center gap-3">
        <PokeballIcon className="h-12 w-12 animate-spin motion-reduce:animate-none" />
        <p className="text-sm text-neutral-400">{label}</p>
      </div>
    </div>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  // The hostname only exists in the browser, so the server and the first client render both show the splash.
  const mounted = useIsClient();

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const mustSignIn = mounted && !isLocalHost() && !loading && !user && !isPublic;

  useEffect(() => {
    if (mustSignIn) router.replace("/login");
  }, [mustSignIn, router]);

  if (isPublic) return <>{children}</>;
  if (!mounted || loading) return <Splash label="Loading workspace…" />;
  if (mustSignIn) return <Splash label="Redirecting to sign in…" />;
  return <>{children}</>;
}
