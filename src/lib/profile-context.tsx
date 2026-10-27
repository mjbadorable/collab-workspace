"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { shrinkDataUrl } from "./image-resize";
import { supabase } from "./supabase";

// Cosmetic titles only: they change the badge colour, never what a user is allowed to do.
export const ROLES = [
  { value: "Trainer", tone: "bg-amber-400 text-neutral-900" },
  { value: "Gym Leader", tone: "bg-emerald-500 text-white" },
  { value: "Professor", tone: "bg-cyan-500 text-white" },
  { value: "Champion", tone: "bg-purple-600 text-white ring-1 ring-amber-300" },
  { value: "Elite Four", tone: "bg-red-600 text-white" },
  { value: "Pokémon", tone: "bg-yellow-300 text-neutral-900" },
  { value: "Team Rocket", tone: "bg-neutral-900 text-red-500 border border-red-500" },
  { value: "Ace Trainer", tone: "bg-blue-600 text-white" },
  { value: "Rival", tone: "bg-orange-500 text-white" },
  { value: "Battle Legend", tone: "bg-indigo-600 text-white" },
] as const;

export type RoleTitle = (typeof ROLES)[number]["value"];

export const DEFAULT_ROLE: RoleTitle = "Trainer";

const asRole = (value: unknown): RoleTitle => ROLES.find((r) => r.value === value)?.value ?? DEFAULT_ROLE;

export const roleTone = (role: string): string => (ROLES.find((r) => r.value === role) ?? ROLES[0]).tone;

export type UserProfile = { name: string; description: string; avatar_url: string | null; role: RoleTitle };

export const DEFAULT_PROFILE: UserProfile = {
  name: "Marvin Jhay Adorable",
  description: "DevOps & Systems Architect",
  avatar_url: null,
  role: DEFAULT_ROLE,
};

// Supabase puts user_metadata inside the access token, which is sent with every request, so the cloud copy
// of the avatar is a thumbnail. The full 256px image stays in localStorage on this device.
const CLOUD_AVATAR_PX = 64;
const CLOUD_AVATAR_BYTES = 3_000;

const KEY = "collab-workspace:profile";
const EMPTY: Partial<UserProfile> = {};
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedLocal: Partial<UserProfile> = EMPTY;

function readLocal(): Partial<UserProfile> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // storage blocked: behave as if nothing was saved
  }
  if (raw === cachedRaw) return cachedLocal;
  cachedRaw = raw;
  cachedLocal = EMPTY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<UserProfile>;
      if (parsed && typeof parsed === "object") cachedLocal = parsed;
    } catch {
      // corrupt JSON: ignore it
    }
  }
  return cachedLocal;
}

function writeLocal(profile: UserProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    return; // quota or blocked storage: the cloud copy (if any) still holds the change
  }
  listeners.forEach((l) => l());
}

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
};

type ProfileContext = {
  profile: UserProfile; // stored values with the defaults applied
  displayName: string; // the saved name, else the email prefix, else the default
  email: string | null;
  signedIn: boolean;
  // Saves on this device and, when signed in, to Supabase. Resolves to an error message, or null on success.
  updateProfile: (next: UserProfile) => Promise<string | null>;
};

const Ctx = createContext<ProfileContext | null>(null);

export function useProfile(): ProfileContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const local = useSyncExternalStore(subscribe, readLocal, () => EMPTY);

  const updateProfile = useCallback(
    async (next: UserProfile) => {
      const clean: UserProfile = {
        name: next.name.trim(),
        description: next.description.trim(),
        avatar_url: next.avatar_url,
        role: asRole(next.role),
      };
      writeLocal(clean);
      if (!supabase || !user) return null;
      try {
        const thumb = clean.avatar_url ? await shrinkDataUrl(clean.avatar_url, CLOUD_AVATAR_PX, CLOUD_AVATAR_BYTES) : null;
        const { error } = await supabase.auth.updateUser({
          data: { name: clean.name, description: clean.description, avatar_url: thumb, role: clean.role },
        });
        return error ? `Saved on this device, but cloud sync failed: ${error.message}` : null;
      } catch {
        return "Saved on this device, but cloud sync failed. Check your connection.";
      }
    },
    [user]
  );

  const value = useMemo<ProfileContext>(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const emailPrefix = user?.email?.split("@")[0].replace(/[._-]+/g, " ");
    // Signed in: the cloud values win; the device copy fills gaps (and holds the full-size avatar).
    const storedName = text(meta?.name) ?? text(local.name);
    return {
      profile: {
        name: storedName ?? DEFAULT_PROFILE.name,
        description: text(meta?.description) ?? text(local.description) ?? DEFAULT_PROFILE.description,
        avatar_url: local.avatar_url ?? text(meta?.avatar_url) ?? null,
        role: asRole(text(meta?.role) ?? text(local.role)),
      },
      displayName: storedName ?? emailPrefix ?? DEFAULT_PROFILE.name,
      email: user?.email ?? null,
      signedIn: user !== null,
      updateProfile,
    };
  }, [local, user, updateProfile]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
