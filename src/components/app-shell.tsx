"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { AuthProvider } from "@/lib/auth-context";
import { ProfileProvider } from "@/lib/profile-context";
import { ProjectsProvider } from "@/lib/projects-context";
import { WorkspaceProvider } from "@/lib/workspace-context";
import CommandPalette from "./command-palette";
import { ConfettiCanvas } from "./confetti-burst";
import DeviceHandoffModal from "./device-handoff-modal";
import ShortcutsDialog from "./shortcuts-dialog";
import FocusTimerDock from "./focus-timer-dock";
import TeamRoomDock from "./projects/team-room-dock";
import EditProfileDialog from "./settings/edit-profile-dialog";
import InviteDialog from "./settings/invite-dialog";
import Sidebar from "./sidebar";
import WorkspaceDialog from "./workspace-dialog";
import { NewWorkItemProvider } from "./work-items/new-work-item-context";

// usePathname() is request-time data on dynamic routes, so the sidebar streams in under Suspense.
const SidebarFallback = () => <div className="h-full w-64 border-r border-neutral-200 bg-neutral-50" />;

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
      <WorkspaceProvider>
        {/* usePathname() below is request-time data on dynamic routes, so it must sit under Suspense. */}
        <Suspense fallback={<div className="h-screen" />}>
          <ProjectsProvider>
            <Chrome>{children}</Chrome>
          </ProjectsProvider>
        </Suspense>
      </WorkspaceProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceRequested, setWorkspaceRequested] = useState(false);
  const [inviteRequested, setInviteRequested] = useState(false);
  const [profileRequested, setProfileRequested] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  // "[" folds the desktop sidebar away (and back), unless you are typing or a dialog is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector("dialog[open]")) return;
      setSidebarCollapsed((c) => !c);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // The Team Room belongs to the project whose pages are open.
  const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null;

  // The login page is a full-screen landing page: no sidebar, mobile header or workspace dialog.
  if (pathname === "/login") return <>{children}</>;

  return (
    <NewWorkItemProvider>
    <div className="flex h-screen overflow-hidden">
      {/* Desktop: fixed sidebar */}
      {sidebarCollapsed ? (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          title="Open sidebar ([)"
          aria-label="Open sidebar"
          className="fixed left-0 top-20 z-20 hidden rounded-r-full border border-l-0 border-neutral-200 bg-white py-1.5 pl-1 pr-1.5 text-neutral-500 shadow-md hover:text-neutral-900 md:block"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      ) : (
        <aside className="relative hidden md:block">
          <Suspense fallback={<SidebarFallback />}>
            <Sidebar
              onNewWorkspace={() => setWorkspaceRequested(true)}
              onInvite={() => setInviteRequested(true)}
              onEditProfile={() => setProfileRequested(true)}
              onSearch={() => setPaletteOpen(true)}
              onShortcuts={() => setShortcutsOpen(true)}
              onDeviceHandoff={() => setHandoffOpen(true)}
            />
          </Suspense>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            title="Collapse sidebar ([)"
            aria-label="Collapse sidebar"
            className="absolute -right-3 top-20 z-20 rounded-full border border-neutral-200 bg-white p-1 text-neutral-500 shadow-md hover:text-neutral-900"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </aside>
      )}

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
                onInvite={() => {
                  setMobileOpen(false);
                  setInviteRequested(true);
                }}
                onEditProfile={() => {
                  setMobileOpen(false);
                  setProfileRequested(true);
                }}
                onSearch={() => {
                  setMobileOpen(false);
                  setPaletteOpen(true);
                }}
                onShortcuts={() => {
                  setMobileOpen(false);
                  setShortcutsOpen(true);
                }}
                onDeviceHandoff={() => {
                  setMobileOpen(false);
                  setHandoffOpen(true);
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
    <FocusTimerDock />
    <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    <DeviceHandoffModal open={handoffOpen} onClose={() => setHandoffOpen(false)} />
    <ConfettiCanvas />
    <InviteDialog open={inviteRequested} onClose={() => setInviteRequested(false)} />
    <EditProfileDialog open={profileRequested} onClose={() => setProfileRequested(false)} />
    {projectId && <TeamRoomDock key={projectId} projectId={projectId} />}
    <CommandPalette
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      onNewWorkspace={() => setWorkspaceRequested(true)}
      onEditProfile={() => setProfileRequested(true)}
    />
    </NewWorkItemProvider>
  );
}
