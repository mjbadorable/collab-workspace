"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { AuthProvider } from "@/lib/auth-context";
import { ProfileProvider } from "@/lib/profile-context";
import { ProjectsProvider } from "@/lib/projects-context";
import { WorkspaceProvider } from "@/lib/workspace-context";
import AuthGate from "./auth-gate";
import CommandPalette from "./command-palette";
import { ConfettiCanvas } from "./confetti-burst";
import DebuggerDock from "./debugger-dock";
import DeviceHandoffModal from "./device-handoff-modal";
import NetworkStatusBar from "./network-status-bar";
import { isCode, normalizeCode } from "@/lib/device-handoff";
import ShortcutsDialog from "./shortcuts-dialog";
import FocusTimerDock from "./focus-timer-dock";
import TeamRoomDock from "./projects/team-room-dock";
import EditProfileDialog from "./settings/edit-profile-dialog";
import InviteDialog from "./settings/invite-dialog";
import Sidebar from "./sidebar";
import TopBar from "./top-bar";
import WorkspaceDialog from "./workspace-dialog";
import { NewWorkItemProvider } from "./work-items/new-work-item-context";

// usePathname() is request-time data on dynamic routes, so the sidebar streams in under Suspense.
const SidebarFallback = () => <div className="app-sidebar h-full w-64 border-r border-white/10 bg-[#0c0d10]" />;

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
      <WorkspaceProvider>
        {/* usePathname() below is request-time data on dynamic routes, so it must sit under Suspense. */}
        <Suspense fallback={<div className="h-screen" />}>
          <ProjectsProvider>
            <AuthGate>
              <Chrome>{children}</Chrome>
            </AuthGate>
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
  // Set when the page was opened from a ?handoff=<code> transfer link; the modal then starts on Receive.
  const [initialHandoffCode, setInitialHandoffCode] = useState<string | undefined>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  // A transfer link (/?handoff=H9X2K4) opens the handoff modal on the Receive tab with the code filled in. The
  // location is only readable in the browser, so this has to run after mount. The parameter is removed from the
  // address right away: restoring reloads the page, and a reload must not reopen the modal on a spent code.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("handoff");
    if (raw === null) return;
    params.delete("handoff");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    const code = normalizeCode(raw);
    if (!isCode(code)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL does not exist during server rendering
    setInitialHandoffCode(code);
    setHandoffOpen(true);
  }, []);

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
    <div className="flex min-h-dvh w-full">
      {/* Desktop: fixed sidebar */}
      {sidebarCollapsed ? (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          title="Open sidebar ([)"
          aria-label="Open sidebar"
          className="fixed left-0 top-20 z-40 hidden rounded-r-full border border-l-0 border-neutral-300 bg-white py-1.5 pl-1 pr-1.5 text-neutral-500 shadow-md hover:text-neutral-900 md:block"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      ) : (
        <aside className="sticky top-0 z-40 hidden h-dvh shrink-0 md:block">
          <Suspense fallback={<SidebarFallback />}>
            <Sidebar
              onNewWorkspace={() => setWorkspaceRequested(true)}
              onInvite={() => setInviteRequested(true)}
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
              className="absolute right-2 top-3 rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} aria-hidden />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onMenu={() => setMobileOpen(true)}
          onSearch={() => setPaletteOpen(true)}
          onShortcuts={() => setShortcutsOpen(true)}
          onEditProfile={() => setProfileRequested(true)}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
    <WorkspaceDialog requested={workspaceRequested} onClose={() => setWorkspaceRequested(false)} />
    <FocusTimerDock />
    <DebuggerDock />
    <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    <DeviceHandoffModal
      open={handoffOpen}
      initialCode={initialHandoffCode}
      onClose={() => {
        setHandoffOpen(false);
        setInitialHandoffCode(undefined);
      }}
    />
    <NetworkStatusBar />
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
