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
  Cog,
  Database,
  Home,
  Landmark,
  Layers,
  ListTodo,
  Network,
  LogOut,
  Pencil,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Trash2,
  User,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaces } from "@/lib/workspace-context";
import { useNewWorkItem } from "@/components/work-items/new-work-item-context";
import ActivityBell from "@/components/activity-bell";
import PokeballIcon from "@/components/pokeball-icon";
import ProjectAvatar from "@/components/project-avatar";
import Avatar from "@/components/settings/avatar";
import { mockWorkspace } from "@/lib/mock-data";
import { roleTone, useProfile } from "@/lib/profile-context";
import { useProjects } from "@/lib/projects-context";
import { useTheme } from "@/lib/theme";
import { useWorkspacePermissions } from "@/lib/use-permissions";

const primaryNav: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Projects", href: "/projects", icon: Layers },
  { label: "Trash", href: "/trash", icon: Trash2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

const categoryIcons: Record<"user" | "system" | "backend", LucideIcon> = { user: User, system: Cog, backend: Database };

// Everything a project offers; "diagrams" also expands into its three flow categories.
const projectNav: { label: string; slug: string; icon: LucideIcon }[] = [
  { label: "Overview", slug: "", icon: BookOpen },
  { label: "Work items", slug: "work-items", icon: ListTodo },
  { label: "Cycles", slug: "cycles", icon: RefreshCw },
  { label: "Modules", slug: "modules", icon: Boxes },
  { label: "System Architecture", slug: "architecture", icon: Landmark },
  { label: "Flowchart / Diagrams", slug: "diagrams", icon: Network },
  { label: "Analytics", slug: "dashboards", icon: BarChart3 },
  { label: "Settings", slug: "settings", icon: Settings },
];

const itemClass =(active: boolean) =>
  `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
    active ? "bg-neutral-200 font-medium text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"
  }`;

export default function Sidebar({
  onNavigate,
  onNewWorkspace,
  onInvite,
  onEditProfile,
  onSearch,
}: {
  onNavigate?: () => void;
  onNewWorkspace: () => void;
  onInvite: () => void;
  onEditProfile: () => void;
  onSearch: () => void;
}) {
  const pathname = usePathname();
  const activeCategory = useSearchParams().get("category") ?? "user";
  const router = useRouter();
  const { openDialog } = useNewWorkItem();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { profile, displayName } = useProfile();
  const { projects, currentProject, getProjectDiagrams, openCreateDialog } = useProjects();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { workspaces, current, select } = useWorkspaces();
  // The server also rejects non-admin invites; hiding the menu item just avoids a dead end.
  const { isAdmin: canInvite } = useWorkspacePermissions(user && current ? current.id : null);
  const workspaceName = current?.name ?? mockWorkspace.name;

  // Project sub-routes live under /projects/..., so "Projects" matches only its own page.
  const isActive = (href: string) => (href === "/" || href === "/projects" ? pathname === href : pathname.startsWith(href));

  return (
    <div className="flex h-full w-64 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={switcherOpen}
            onClick={() => setSwitcherOpen((o) => !o)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-100"
          >
            <PokeballIcon className="h-6 w-6 shrink-0" />
            <span className="flex-1 truncate text-sm font-medium">{workspaceName}</span>
            <ChevronsUpDown className="h-4 w-4 text-neutral-400" />
          </button>
          {switcherOpen && (
            <div
              role="menu"
              className="absolute inset-x-0 top-full z-10 mt-1 space-y-0.5 rounded-md border border-neutral-200 bg-white p-1 shadow-lg"
            >
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
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100"
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
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-100"
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
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-100"
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
        <ActivityBell />
        </div>

        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            openDialog();
          }}
          className="flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-700 shadow-sm hover:bg-neutral-100"
        >
          <Plus className="h-4 w-4" />
          <span className="flex-1 text-left">New work item</span>
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 font-mono text-[10px] text-neutral-500">
            C
          </kbd>
        </button>

        <button
          type="button"
          onClick={onSearch}
          aria-label="Search and jump (Ctrl+K)"
          className="flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-500 shadow-sm hover:bg-neutral-100"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 text-left">Search &amp; jump…</span>
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 font-mono text-[10px] text-neutral-500">Ctrl K</kbd>
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-3" aria-label="Main">
        <ul className="space-y-0.5">
          {primaryNav.map(({ label, href, icon: Icon }) => (
            <li key={href}>
              <Link href={href} onClick={onNavigate} className={itemClass(isActive(href))}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div>
          <div className="flex items-center justify-between px-2.5 pb-1">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Projects</p>
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                openCreateDialog();
              }}
              aria-label="Create project"
              title="Create project"
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-red-600"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <ul className="space-y-0.5">
            {projects.map((project, index) => {
              // An explicit toggle wins; otherwise the project you're in (or the first one) starts expanded.
              const expanded = open[project.id] ?? (currentProject ? currentProject.id === project.id : index === 0);
              const Chevron = expanded ? ChevronDown : ChevronRight;
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen((s) => ({ ...s, [project.id]: !expanded }))}
                    className={`${itemClass(false)} w-full`}
                  >
                    <Chevron className="h-4 w-4 shrink-0 text-neutral-400" />
                    <ProjectAvatar project={project} className="h-5 w-5 text-[11px]" />
                    <span className="truncate">{project.name}</span>
                  </button>
                  {expanded && (
                    <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-neutral-200 pl-2">
                      {projectNav.map((link) => {
                        const href = `/projects/${project.id}${link.slug ? `/${link.slug}` : ""}`;
                        const LinkIcon = link.icon;
                        if (link.slug !== "diagrams") {
                          return (
                            <li key={link.slug || "overview"}>
                              <Link href={href} onClick={onNavigate} className={itemClass(pathname === href)}>
                                <LinkIcon className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                                {link.label}
                              </Link>
                            </li>
                          );
                        }
                        const diagramsKey = `${project.id}:diagrams`;
                        const diagramsOpen = open[diagramsKey] ?? pathname === href;
                        const DiagramChevron = diagramsOpen ? ChevronDown : ChevronRight;
                        return (
                          <li key={link.slug}>
                            <div className="flex items-center">
                              <Link href={href} onClick={onNavigate} className={`${itemClass(pathname === href)} flex-1`}>
                                <LinkIcon className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                                {link.label}
                              </Link>
                              <button
                                type="button"
                                aria-expanded={diagramsOpen}
                                aria-label={`${diagramsOpen ? "Collapse" : "Expand"} diagrams`}
                                onClick={() => setOpen((s) => ({ ...s, [diagramsKey]: !diagramsOpen }))}
                                className="rounded p-1 text-neutral-400 hover:bg-neutral-200"
                              >
                                <DiagramChevron className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                            {diagramsOpen && (
                              <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-neutral-200 pl-2">
                                {getProjectDiagrams(project.id).map((d) => (
                                  <li key={d.id}>
                                    <Link href={d.href} onClick={onNavigate} className={itemClass(pathname === href && activeCategory === d.id)}>
                                      {(() => {
                                        const CategoryIcon = categoryIcons[d.id];
                                        return <CategoryIcon className="h-3.5 w-3.5 text-neutral-400" aria-hidden />;
                                      })()}
                                      <span className="truncate">{d.name}</span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="border-t border-neutral-200 p-3">
        {loading ? (
          <div className="h-12" aria-hidden />
        ) : (
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                onEditProfile();
              }}
              aria-label="Edit profile"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <Avatar url={profile.avatar_url} name={displayName} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={user?.email ?? undefined}>
                {displayName}
              </p>
              <p className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                <span className={`shrink-0 whitespace-nowrap rounded px-1 text-[10px] font-semibold uppercase ${roleTone(profile.role)}`}>
                  {profile.role}
                </span>
                <span className="min-w-0 truncate">{user ? "Signed in" : "Local preview"} · Admin</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                onEditProfile();
              }}
              title="Edit profile"
              aria-label="Edit profile"
              className="rounded p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              title="Switch between Poké-Center Light and Silph Co. Dark"
              aria-label="Switch between Poké-Center Light and Silph Co. Dark"
              className="rounded p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {user ? (
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push("/login");
                }}
                title="Sign out"
                aria-label="Sign out"
                className="rounded p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <Link href="/login" onClick={onNavigate} className="text-xs font-medium text-red-600 hover:underline">
                Sign in
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
