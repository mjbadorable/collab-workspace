"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Boxes,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Check,
  ChevronsUpDown,
  Code2,
  Cog,
  Database,
  Home,
  Inbox,
  Landmark,
  Laptop,
  Layers,
  ListTodo,
  Network,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  User,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaces } from "@/lib/workspace-context";
import { useNewWorkItem } from "@/components/work-items/new-work-item-context";
import CollabLogo from "@/components/collab-logo";
import EnvironmentSwitcher from "@/components/environment-switcher";
import ProjectAvatar from "@/components/project-avatar";
import { useActivityLog } from "@/lib/activity-log";
import { mockWorkspace } from "@/lib/mock-data";
import { useProjects } from "@/lib/projects-context";
import { useWorkspacePermissions } from "@/lib/use-permissions";

const workspaceNav: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Projects", href: "/projects", icon: Layers },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Trash", href: "/trash", icon: Trash2 },
];

const categoryIcons: Record<"user" | "system" | "backend", LucideIcon> = { user: User, system: Cog, backend: Database };

// Everything a project offers; "diagrams" also expands into its three flow categories.
const projectNav: { label: string; slug: string; icon: LucideIcon }[] = [
  { label: "Overview", slug: "", icon: BookOpen },
  { label: "Work Items", slug: "work-items", icon: ListTodo },
  { label: "Cycles", slug: "cycles", icon: RefreshCw },
  { label: "Modules", slug: "modules", icon: Boxes },
  { label: "System Architecture", slug: "architecture", icon: Landmark },
  { label: "Flowcharts / Diagrams", slug: "diagrams", icon: Network },
  { label: "Analytics", slug: "dashboards", icon: BarChart3 },
  { label: "Source Code", slug: "source", icon: Code2 },
  { label: "Project Settings", slug: "settings", icon: Settings },
];

// Burgundy sidebar: a translucent white pill marks the active page, with a thin amber edge.
const itemClass = (active: boolean) =>
  `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
    active ? "bg-white/15 font-medium text-white shadow-[inset_2px_0_0_#F59E0B]" : "text-white/75 hover:bg-white/10 hover:text-white"
  }`;

const iconClass = (active: boolean) => `h-4 w-4 shrink-0 ${active ? "text-amber-300" : "text-white/55"}`;

const sectionLabel = "px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/45";

const menuItem = "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100";

export default function Sidebar({
  onNavigate,
  onNewWorkspace,
  onInvite,
  onDeviceHandoff,
}: {
  onNavigate?: () => void;
  onNewWorkspace: () => void;
  onInvite: () => void;
  onDeviceHandoff: () => void;
}) {
  const pathname = usePathname();
  const activeCategory = useSearchParams().get("category") ?? "user";
  const router = useRouter();
  const { openDialog } = useNewWorkItem();
  const [diagramsOpen, setDiagramsOpen] = useState<Record<string, boolean>>({});
  const { projects, currentProject, getProjectDiagrams, openCreateDialog } = useProjects();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const { user } = useAuth();
  const { workspaces, current, select } = useWorkspaces();
  const { unread } = useActivityLog();
  // The server also rejects non-admin invites; hiding the menu item just avoids a dead end.
  const { isAdmin: canInvite } = useWorkspacePermissions(user && current ? current.id : null);
  const workspaceName = current?.name ?? mockWorkspace.name;

  // The project whose pages are open; elsewhere, the one picked in the selector, else the first in the fleet order.
  const active = currentProject ?? projects.find((p) => p.id === pickedId) ?? projects[0] ?? null;

  // Project sub-routes live under /projects/..., so "Projects" matches only its own page.
  const isActive = (href: string) => (href === "/" || href === "/projects" ? pathname === href : pathname.startsWith(href));

  const pickProject = (id: string) => {
    setPickedId(id);
    setProjectMenuOpen(false);
    onNavigate?.();
    router.push(`/projects/${id}`);
  };

  return (
    <div className="app-sidebar flex h-full w-64 flex-col bg-[#0c0d10] bg-linear-to-b from-[#121317] to-[#090a0c] border-r border-white/10 text-neutral-100">
      <div className="space-y-3 p-3">
        <Link href="/" onClick={onNavigate} aria-label="Collab Workspace home" className="block rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
          <CollabLogo variant="full" onDark className="h-9 w-9" />
        </Link>

        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={switcherOpen}
            onClick={() => setSwitcherOpen((o) => !o)}
            className="flex w-full items-center gap-2 rounded-md bg-white/10 px-2.5 py-1.5 text-left text-sm hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span className="flex-1 truncate font-medium">{workspaceName}</span>
            <ChevronsUpDown className="h-4 w-4 text-white/55" aria-hidden />
          </button>
          {switcherOpen && (
            <div role="menu" className="absolute inset-x-0 top-full z-30 mt-1 space-y-0.5 rounded-md border border-neutral-200 bg-white p-1 text-neutral-900 shadow-lg">
              {user ? (
                <>
                  {workspaces.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        select(w.id);
                        setSwitcherOpen(false);
                      }}
                      className={menuItem}
                    >
                      <span className="flex-1 truncate">{w.name}</span>
                      {w.id === current?.id && <Check className="h-4 w-4 text-red-600" />}
                    </button>
                  ))}
                  {current && canInvite && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSwitcherOpen(false);
                        onInvite();
                      }}
                      className={menuItem}
                    >
                      <UserPlus className="h-4 w-4" /> Invite members
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSwitcherOpen(false);
                      onNewWorkspace();
                    }}
                    className={menuItem}
                  >
                    <Plus className="h-4 w-4" /> New workspace
                  </button>
                </>
              ) : (
                <>
                  <p className="px-2 py-1.5 text-xs text-neutral-500">Local preview workspace</p>
                  <Link
                    href="/login"
                    role="menuitem"
                    onClick={() => {
                      setSwitcherOpen(false);
                      onNavigate?.();
                    }}
                    className="block rounded px-2 py-1.5 text-sm text-red-600 hover:bg-neutral-100"
                  >
                    Sign in to use cloud workspaces
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            openDialog();
          }}
          className="flex w-full items-center gap-2 rounded-md bg-amber-500 px-2.5 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span className="flex-1 text-left">New work item</span>
          <kbd className="rounded bg-black/15 px-1.5 font-mono text-[10px]">C</kbd>
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3" aria-label="Main">
        <div>
          <p className={sectionLabel}>Workspace</p>
          <ul className="space-y-0.5">
            {workspaceNav.map(({ label, href, icon: Icon }) => (
              <li key={href}>
                <Link href={href} onClick={onNavigate} aria-current={isActive(href) ? "page" : undefined} className={itemClass(isActive(href))}>
                  <Icon className={iconClass(isActive(href))} aria-hidden />
                  <span className="flex-1">{label}</span>
                  {href === "/inbox" && unread > 0 && (
                    <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold tabular-nums leading-4 text-neutral-950">
                      <span className="sr-only">{unread} unread </span>
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between pr-1">
            <p className={sectionLabel}>Active project</p>
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                openCreateDialog();
              }}
              aria-label="Create project"
              title="Create project"
              className="mb-1 rounded p-0.5 text-white/55 hover:bg-white/10 hover:text-amber-300"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {active ? (
            <>
              <div className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={projectMenuOpen}
                  onClick={() => setProjectMenuOpen((o) => !o)}
                  className="flex w-full items-center gap-2 rounded-md bg-white/10 px-2 py-1.5 text-left text-sm hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <ProjectAvatar project={active} className="h-6 w-6 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{active.name}</span>
                    <span className="block font-mono text-[10px] text-white/50">{active.identifier}</span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/55" aria-hidden />
                </button>
                {projectMenuOpen && (
                  <div role="menu" className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 space-y-0.5 overflow-y-auto rounded-md border border-neutral-200 bg-white p-1 text-neutral-900 shadow-lg">
                    {projects.map((p) => (
                      <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === active.id} onClick={() => pickProject(p.id)} className={menuItem}>
                        <ProjectAvatar project={p} className="h-5 w-5 text-[10px]" />
                        <span className="flex-1 truncate">{p.name}</span>
                        {p.id === active.id && <Check className="h-4 w-4 text-red-600" aria-hidden />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <ul className="mt-2 space-y-0.5">
                {projectNav.map((link) => {
                  const href = `/projects/${active.id}${link.slug ? `/${link.slug}` : ""}`;
                  const LinkIcon = link.icon;
                  const here = pathname === href;
                  if (link.slug !== "diagrams") {
                    return (
                      <li key={link.slug || "overview"}>
                        <Link href={href} onClick={onNavigate} aria-current={here ? "page" : undefined} className={itemClass(here)}>
                          <LinkIcon className={iconClass(here)} aria-hidden />
                          {link.label}
                        </Link>
                      </li>
                    );
                  }
                  const diagramsKey = `${active.id}:diagrams`;
                  const expanded = diagramsOpen[diagramsKey] ?? here;
                  const DiagramChevron = expanded ? ChevronDown : ChevronRight;
                  return (
                    <li key={link.slug}>
                      <div className="flex items-center gap-0.5">
                        <Link href={href} onClick={onNavigate} aria-current={here ? "page" : undefined} className={`${itemClass(here)} min-w-0 flex-1`}>
                          <LinkIcon className={iconClass(here)} aria-hidden />
                          <span className="truncate">{link.label}</span>
                        </Link>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Collapse" : "Expand"} diagrams`}
                          onClick={() => setDiagramsOpen((s) => ({ ...s, [diagramsKey]: !expanded }))}
                          className="rounded p-1 text-white/55 hover:bg-white/10 hover:text-white"
                        >
                          <DiagramChevron className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      {expanded && (
                        <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-white/15 pl-2">
                          {getProjectDiagrams(active.id).map((d) => {
                            const CategoryIcon = categoryIcons[d.id];
                            const on = here && activeCategory === d.id;
                            return (
                              <li key={d.id}>
                                <Link href={d.href} onClick={onNavigate} className={itemClass(on)}>
                                  <CategoryIcon className={iconClass(on)} aria-hidden />
                                  <span className="truncate">{d.name}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="px-2.5 text-xs text-white/55">No projects yet.</p>
          )}
        </div>
      </nav>

      <div className="space-y-2 border-t border-white/10 p-3">
        <EnvironmentSwitcher />
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onDeviceHandoff();
          }}
          title="Hand this session over to your other machine"
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Laptop className="h-4 w-4 text-white/55" aria-hidden />
          <span className="flex-1 text-left">Device handoff</span>
          <span aria-hidden>📡</span>
        </button>
      </div>
    </div>
  );
}
