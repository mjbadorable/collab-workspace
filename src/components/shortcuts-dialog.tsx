"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const GROUPS: { title: string; shortcuts: { keys: string[]; label: string }[] }[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["Ctrl", "K"], label: "Command Palette (⌘K on Mac)" },
      { keys: ["?"], label: "Keyboard cheat-sheet" },
      { keys: ["Esc"], label: "Close dialogs and docks" },
    ],
  },
  {
    title: "Work Items Board",
    shortcuts: [
      { keys: ["C"], label: "New work item" },
      { keys: ["/"], label: "Focus the search box" },
      { keys: ["B"], label: "Board view" },
      { keys: ["L"], label: "List view" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 font-mono text-xs font-medium text-neutral-700 shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
      {children}
    </kbd>
  );
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

// Press ? anywhere (outside a text field) to see every shortcut; the sidebar's keyboard button opens it too.
export default function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      // With another dialog open, ? should not stack a second one on top.
      if (!open && document.querySelector("dialog[open]")) return;
      e.preventDefault();
      onOpenChange(!open);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

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
      aria-label="Keyboard shortcuts"
      className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">⌨️ Keyboard Shortcuts</h2>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {GROUPS.map((g) => (
          <section key={g.title} className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{g.title}</h3>
            <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {g.shortcuts.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>{s.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {s.keys.map((k, i) => (
                      <span key={k} className="flex items-center gap-1">
                        {i > 0 && <span className="text-xs text-neutral-400">+</span>}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </dialog>
  );
}
