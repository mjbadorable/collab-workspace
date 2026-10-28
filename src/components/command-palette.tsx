"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { useNewWorkItem } from "@/components/work-items/new-work-item-context";
import { getProjects } from "@/lib/projects";
import { useProjects } from "@/lib/projects-context";
import { useTheme } from "@/lib/theme";
import { loadWorkItems, workItemKey } from "@/lib/work-items-storage";

type Group = "Quick Actions" | "Projects & Views" | "Work Items";

type Command = { id: string; group: Group; label: string; hint?: string; run: () => void };

const MAX_RESULTS = 40;
const EMPTY_QUERY_ITEMS = 5;

// Every word of the query must appear in the text, either as a substring (scored higher the earlier it sits)
// or loosely as an in-order subsequence. Returns -1 when something does not match.
function score(query: string, text: string): number {
  const haystack = text.toLowerCase();
  let total = 0;
  for (const word of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const at = haystack.indexOf(word);
    if (at >= 0) {
      total += 100 - Math.min(at, 90);
      continue;
    }
    let from = 0;
    for (const ch of word) {
      from = haystack.indexOf(ch, from) + 1;
      if (from === 0) return -1;
    }
    total += 10;
  }
  return total;
}

function PaletteBody({
  onClose,
  onNewWorkspace,
  onEditProfile,
}: {
  onClose: () => void;
  onNewWorkspace: () => void;
  onEditProfile: () => void;
}) {
  const router = useRouter();
  const { openDialog } = useNewWorkItem();
  const { projects, openCreateDialog } = useProjects();
  const { toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const list: Command[] = [
      { id: "qa-new-item", group: "Quick Actions", label: "New work item", hint: "C", run: openDialog },
      { id: "qa-new-project", group: "Quick Actions", label: "Create new project", run: openCreateDialog },
      { id: "qa-profile", group: "Quick Actions", label: "Edit profile", run: onEditProfile },
      { id: "qa-workspace", group: "Quick Actions", label: "New workspace", run: onNewWorkspace },
      { id: "qa-theme", group: "Quick Actions", label: "Toggle Theme: Poké-Center Light / Silph Co. Dark", run: toggleTheme },
      { id: "qa-home", group: "Quick Actions", label: "Go to Home", run: go("/") },
      { id: "qa-projects", group: "Quick Actions", label: "Go to Projects Hub", run: go("/projects") },
      { id: "qa-settings", group: "Quick Actions", label: "Go to Settings", run: go("/settings") },
      { id: "qa-trash", group: "Quick Actions", label: "Go to Trash", run: go("/trash") },
    ];
    for (const p of projects) {
      const views: [string, string][] = [
        ["Overview", ""],
        ["Work Items", "/work-items"],
        ["System Architecture", "/architecture"],
        ["Process Flowcharts", "/diagrams?category=user"],
        ["Settings", "/settings"],
      ];
      for (const [view, path] of views) {
        list.push({ id: `${p.id}${path}`, group: "Projects & Views", label: `${p.name} — ${view}`, run: go(`/projects/${p.id}${path}`) });
      }
    }
    // Local copies of each project's board; mounted only while the palette is open, so this reads fresh every time.
    for (const p of getProjects()) {
      for (const item of loadWorkItems(p.id)) {
        if (item.deleted_at) continue;
        const key = workItemKey(p.id, item.seq);
        list.push({ id: `wi-${p.id}-${item.id}`, group: "Work Items", label: `${key}  ${item.title}`, hint: p.name, run: go(`/projects/${p.id}/work-items`) });
      }
    }
    return list;
  }, [router, openDialog, openCreateDialog, onEditProfile, onNewWorkspace, toggleTheme, projects]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) {
      const items = commands.filter((c) => c.group === "Work Items").slice(0, EMPTY_QUERY_ITEMS);
      return [...commands.filter((c) => c.group !== "Work Items"), ...items];
    }
    return commands
      .map((c) => ({ c, s: score(q, `${c.label} ${c.hint ?? ""}`) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_RESULTS)
      .map((r) => r.c);
  }, [commands, query]);

  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(results.length ? (activeIndex + 1) % results.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(results.length ? (activeIndex - 1 + results.length) % results.length : 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[activeIndex]);
    }
  };

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded
          aria-controls="cmd-results"
          aria-activedescendant={results[activeIndex] ? `cmd-${results[activeIndex].id}` : undefined}
          aria-label="Search commands, projects and work items"
          placeholder="Search projects, tickets (CW-1), or run a command…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
        <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 font-mono text-[10px] text-neutral-500">Esc</kbd>
      </div>
      <ul ref={listRef} id="cmd-results" role="listbox" className="overflow-y-auto p-2">
        {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-neutral-500">No results for “{query}”.</li>}
        {results.map((c, i) => (
          <li key={c.id} role="presentation">
            {(i === 0 || results[i - 1].group !== c.group) && (
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-neutral-400">{c.group}</p>
            )}
            <div
              id={`cmd-${c.id}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseMove={() => setActive(i)}
              onClick={() => run(c)}
              className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${
                i === activeIndex ? "bg-red-50 text-red-900" : "text-neutral-700"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              {c.hint && (
                <span className="shrink-0 rounded border border-neutral-200 bg-white px-1.5 font-mono text-[10px] text-neutral-500">
                  {c.hint}
                </span>
              )}
              {i === activeIndex && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Ctrl+K / Cmd+K toggles it from anywhere; Esc, a backdrop click or running a command closes it.
// `open` is owned by the parent so the sidebar's search button can open it too.
export default function CommandPalette({
  open,
  onOpenChange,
  onNewWorkspace,
  onEditProfile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewWorkspace: () => void;
  onEditProfile: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  // Native <dialog> gives focus trapping and an inert page behind it.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
      aria-label="Command palette"
      className="mx-auto mt-[12vh] w-full max-w-xl rounded-xl border border-neutral-200 p-0 shadow-2xl backdrop:bg-black/30"
    >
      {/* Mounting the body only while open resets the query and re-reads the work items each time. */}
      {open && <PaletteBody onClose={() => onOpenChange(false)} onNewWorkspace={onNewWorkspace} onEditProfile={onEditProfile} />}
    </dialog>
  );
}
