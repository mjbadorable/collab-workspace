"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getProjects, SEED_PROJECT } from "@/lib/projects";

type NewWorkItemContext = {
  open: boolean;
  openDialog: () => void;
  // Opens the dialog with the title field pre-filled (used to tag a work item to an architecture or flowchart node).
  openDialogWithTitle: (title: string, projectId?: string) => void;
  presetTitle: string;
  closeDialog: () => void;
};

const Ctx = createContext<NewWorkItemContext | null>(null);

export function useNewWorkItem(): NewWorkItemContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNewWorkItem must be used inside NewWorkItemProvider");
  return ctx;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

// Dialog state lives above the routes so the sidebar button and the `C` shortcut can
// open it from any page; WorkItemsView renders the dialog itself.
export function NewWorkItemProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [presetTitle, setPresetTitle] = useState("");

  const openFor = useCallback(
    (title: string, forProject?: string) => {
      // Read the URL at call time (not via usePathname) so this provider needs no Suspense boundary.
      const { pathname } = window.location;
      const projectId = forProject ?? pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? getProjects()[0]?.id ?? SEED_PROJECT.id;
      if (!pathname.startsWith(`/projects/${projectId}/work-items`)) {
        router.push(`/projects/${projectId}/work-items`);
      }
      setPresetTitle(title);
      setOpen(true);
    },
    [router]
  );

  const openDialog = useCallback(() => openFor(""), [openFor]);
  const openDialogWithTitle = useCallback((title: string, projectId?: string) => openFor(title, projectId), [openFor]);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setPresetTitle("");
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "c" || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (open || isTyping(e.target)) return;
      e.preventDefault();
      openDialog();
    };
    // Browser back/forward could leave the dialog flagged open on a page that doesn't render it.
    const onPopState = () => setOpen(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, [open, openDialog]);

  const value = useMemo(
    () => ({ open, openDialog, openDialogWithTitle, presetTitle, closeDialog }),
    [open, openDialog, openDialogWithTitle, presetTitle, closeDialog]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
