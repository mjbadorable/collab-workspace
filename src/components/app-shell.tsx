"use client";

import { Suspense, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { AuthProvider } from "@/lib/auth-context";
import { WorkspaceProvider } from "@/lib/workspace-context";
import Sidebar from "./sidebar";
import WorkspaceDialog from "./workspace-dialog";
import { NewWorkItemProvider } from "./work-items/new-work-item-context";

// usePathname() is request-time data on dynamic routes, so the sidebar streams in under Suspense.
const SidebarFallback = () => <div className="h-full w-64 border-r border-neutral-200 bg-neutral-50" />;

export default function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceRequested, setWorkspaceRequested] = useState(false);

  return (
    <AuthProvider>
    <WorkspaceProvider>
    <NewWorkItemProvider>
    <div className="flex h-screen overflow-hidden">
      {/* Desktop: fixed sidebar */}
      <aside className="hidden md:block">
        <Suspense fallback={<SidebarFallback />}>
          <Sidebar onNewWorkspace={() => setWorkspaceRequested(true)} />
        </Suspense>
      </aside>

      {/* Mobile: slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="relative">
            <Suspense fallback={<SidebarFallback />}>
              <Sidebar
                onNavigate={() => setMobileOpen(false)}
                onNewWorkspace={() => {
                  setMobileOpen(false);
                  setWorkspaceRequested(true);
                }}
              />
            </Suspense>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded p-1 text-neutral-500 hover:bg-neutral-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} aria-hidden />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center border-b border-neutral-200 px-4 py-2 md:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="rounded p-1 text-neutral-600 hover:bg-neutral-100"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
    <WorkspaceDialog requested={workspaceRequested} onClose={() => setWorkspaceRequested(false)} />
    </NewWorkItemProvider>
    </WorkspaceProvider>
    </AuthProvider>
  );
}
