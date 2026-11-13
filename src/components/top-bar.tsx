"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Keyboard, LogIn, LogOut, Menu, Moon, Pencil, Search, Settings, Sun } from "lucide-react";
import ActivityBell from "@/components/activity-bell";
import Avatar from "@/components/settings/avatar";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-context";
import { useTheme } from "@/lib/theme";
import { useIsClient } from "@/lib/use-is-client";

function ProfileChip({ onEditProfile, onShortcuts }: { onEditProfile: () => void; onShortcuts: () => void }) {
  const { profile, displayName } = useProfile();
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const mounted = useIsClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Profile data comes from localStorage / the session, so nothing renders until the client has it.
  if (!mounted || loading) return <div className="h-9 w-9 sm:w-52" aria-hidden />;

  const item =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400";
  const rolePill = "rounded-full bg-[#7F1D1D] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white";
  const email = user?.email ?? "Local preview";
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white py-1 pl-1.5 pr-3 shadow-xs hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <Avatar url={profile.avatar_url} name={displayName} />
        <span className="hidden min-w-0 text-left leading-tight sm:block">
          <span className="block max-w-36 truncate text-sm font-semibold">{displayName}</span>
          <span className="block max-w-36 truncate text-[11px] text-neutral-500">{email}</span>
        </span>
        <span className={`hidden whitespace-nowrap sm:inline ${rolePill}`}>{profile.role}</span>
        <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl">
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-bold text-neutral-900">{displayName}</p>
            <p className="truncate text-xs text-neutral-500">{email}</p>
            <span className={`mt-2 inline-block ${rolePill}`}>{profile.role}</span>
          </div>
          <div className="my-1 border-t border-neutral-100" role="separator" />
          <Link href="/settings" role="menuitem" onClick={close} className={item}>
            <Settings className="h-4 w-4 text-neutral-500" aria-hidden /> Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onShortcuts();
            }}
            className={item}
          >
            <Keyboard className="h-4 w-4 text-neutral-500" aria-hidden /> Keyboard shortcuts
          </button>
          <button type="button" role="menuitem" onClick={toggleTheme} className={item}>
            <ThemeIcon className="h-4 w-4 text-neutral-500" aria-hidden />
            <span className="flex-1">Theme: {theme === "dark" ? "Dark" : "Light"}</span>
            <span className="text-xs text-neutral-400">switch to {theme === "dark" ? "Light" : "Dark"}</span>
          </button>
          <div className="my-1 border-t border-neutral-100" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onEditProfile();
            }}
            className={item}
          >
            <Pencil className="h-4 w-4 text-neutral-500" aria-hidden /> Edit profile
          </button>
          {user ? (
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                close();
                await signOut();
                router.push("/login");
              }}
              className={item}
            >
              <LogOut className="h-4 w-4 text-neutral-500" aria-hidden /> Sign out
            </button>
          ) : (
            <Link href="/login" role="menuitem" onClick={close} className={`${item} text-red-600`}>
              <LogIn className="h-4 w-4" aria-hidden /> Sign in
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// Utility bar above every workspace page: global search, notifications, shortcuts and the profile menu.
export default function TopBar({
  onMenu,
  onSearch,
  onShortcuts,
  onEditProfile,
}: {
  onMenu: () => void;
  onSearch: () => void;
  onShortcuts: () => void;
  onEditProfile: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-neutral-200 bg-white px-3 sm:px-4">
      <button type="button" aria-label="Open menu" onClick={onMenu} className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100 md:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onSearch}
        aria-label="Search projects, tasks, docs or commands (Ctrl+K)"
        className="flex min-w-0 max-w-xl flex-1 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-500 hover:border-neutral-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">Search projects, tasks, docs, or commands...</span>
        <kbd className="hidden shrink-0 rounded border border-neutral-200 bg-white px-1.5 font-mono text-[10px] text-neutral-500 sm:block">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <ActivityBell align="right" />
        <button
          type="button"
          onClick={onShortcuts}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <Keyboard className="h-4 w-4" aria-hidden />
        </button>
        <ProfileChip onEditProfile={onEditProfile} onShortcuts={onShortcuts} />
      </div>
    </header>
  );
}
