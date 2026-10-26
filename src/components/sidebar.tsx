"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Home,
  Layers,
  Palette,
  Plus,
  Settings,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useNewWorkItem } from "@/components/work-items/new-work-item-context";
import { initials, mockProjects, mockUser, mockWorkspace, projectLinks } from "@/lib/mock-data";

const primaryNav: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Projects", href: "/projects", icon: Layers },
  { label: "Design", href: "/design", icon: Palette },
  { label: "Trash", href: "/trash", icon: Trash2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

const itemClass = (active: boolean) =>
  `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
    active ? "bg-neutral-200 font-medium text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"
  }`;

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { openDialog } = useNewWorkItem();
  const [open, setOpen] = useState<Record<string, boolean>>({ [mockProjects[0].id]: true });

  // Project sub-routes live under /projects/..., so "Projects" matches only its own page.
  const isActive = (href: string) => (href === "/" || href === "/projects" ? pathname === href : pathname.startsWith(href));

  return (
    <div className="flex h-full w-64 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="space-y-2 p-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-100"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-xs font-semibold text-white">
            {mockWorkspace.name[0]}
          </span>
          <span className="flex-1 truncate text-sm font-medium">{mockWorkspace.name}</span>
          <ChevronsUpDown className="h-4 w-4 text-neutral-400" />
        </button>

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
          <p className="px-2.5 pb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Projects</p>
          <ul className="space-y-0.5">
            {mockProjects.map((project) => {
              const expanded = !!open[project.id];
              const Chevron = expanded ? ChevronDown : ChevronRight;
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen((s) => ({ ...s, [project.id]: !expanded }))}
                    className={`${itemClass(false)} w-full`}
                  >
                    <Chevron className="h-4 w-4 text-neutral-400" />
                    <span className="truncate">{project.name}</span>
                  </button>
                  {expanded && (
                    <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-neutral-200 pl-2">
                      {projectLinks.map((link) => {
                        const href = `/projects/${project.id}/${link.slug}`;
                        return (
                          <li key={link.slug}>
                            <Link href={href} onClick={onNavigate} className={itemClass(pathname === href)}>
                              {link.label}
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
        </div>
      </nav>

      <div className="border-t border-neutral-200 p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
            {initials(mockUser.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{mockUser.name}</p>
            <p className="truncate text-xs text-neutral-500">{mockUser.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
