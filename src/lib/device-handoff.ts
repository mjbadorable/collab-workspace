import { useSyncExternalStore } from "react";
import { downloadFile } from "./project-report";

const PREFIX = "collab-workspace:";
export const HANDOFF_VERSION = 1;
export const CODE_LENGTH = 6;
// The server mints codes from an alphabet with no I, O, 0 or 1 in it, so a code can be read out loud.
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

const DEVICE_KEY = `${PREFIX}device-name`;
const LOG_KEY = `${PREFIX}handoff-log`;
// These describe *this* machine, so a pull must never overwrite them with the sending machine's copy.
const LOCAL_ONLY_KEYS = [DEVICE_KEY, LOG_KEY];
const MAX_LOG = 12;
const MAX_DEVICE_NAME = 40;
export const MAX_MEMO = 500;

// One device's workspace state plus the note explaining where the work was left off.
export type HandoffSnapshot = {
  version: number;
  device: string;
  memo: string;
  createdAt: string;
  keysCount: number;
  data: Record<string, string>;
};

export type HandoffLogEntry = {
  id: string;
  ts: number;
  direction: "pushed" | "pulled";
  code: string;
  device: string;
  memo: string;
  keysCount: number;
};

export type PushResult = { ok: true; code: string; expiresAt: number } | { ok: false; error: string };
export type PullResult = { ok: true; snapshot: HandoffSnapshot } | { ok: false; error: string };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/* ---------- this device ---------- */

// Only ever a hint for the name field; the user is expected to rename it to "Edtech-03" or "Laptop".
function guessDeviceName(): string {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Android|iPhone|iPad/i.test(agent)) return "Phone";
  if (/Macintosh|Mac OS/i.test(agent)) return "Mac";
  if (/Windows/i.test(agent)) return "Windows PC";
  return "This device";
}

export const getDeviceName = (): string => read(DEVICE_KEY) || guessDeviceName();

export function setDeviceName(name: string): void {
  const clean = name.trim().slice(0, MAX_DEVICE_NAME);
  try {
    if (clean) localStorage.setItem(DEVICE_KEY, clean);
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    return; // storage blocked: the name just falls back to the guess
  }
  notify();
}

/* ---------- snapshots ---------- */

// Every workspace key on this device (projects, boards, diagrams, designs, cycles, notes), copied exactly as
// stored, minus the two keys that belong to this machine alone.
export function collectSnapshot(memo: string): HandoffSnapshot {
  const data: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX) || LOCAL_ONLY_KEYS.includes(key)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    }
  } catch {
    // storage blocked: the snapshot is whatever could be read
  }
  return {
    version: HANDOFF_VERSION,
    device: getDeviceName(),
    memo: memo.trim().slice(0, MAX_MEMO),
    createdAt: new Date().toISOString(),
    keysCount: Object.keys(data).length,
    data,
  };
}

// Shape check only: whether the keys inside are safe to write is decided by applySnapshot.
export function isSnapshot(value: unknown): value is HandoffSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<HandoffSnapshot>;
  return (
    s.version === HANDOFF_VERSION &&
    typeof s.device === "string" &&
    typeof s.memo === "string" &&
    typeof s.createdAt === "string" &&
    typeof s.data === "object" &&
    s.data !== null &&
    !Array.isArray(s.data) &&
    Object.entries(s.data).every(([key, v]) => key.startsWith(PREFIX) && typeof v === "string")
  );
}

// Checks the whole snapshot first and writes nothing unless all of it is valid. Keys on this device that the
// snapshot does not mention are left alone, and this device's own name and handoff log always survive.
// On success the page reloads so every provider re-reads the restored data.
export function applySnapshot(snapshot: HandoffSnapshot): { ok: boolean; count: number; error?: string } {
  if (!isSnapshot(snapshot)) return { ok: false, count: 0, error: "That handoff was made by a different version and cannot be restored here." };

  const entries = Object.entries(snapshot.data).filter(([key]) => !LOCAL_ONLY_KEYS.includes(key));
  try {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  } catch {
    return { ok: false, count: 0, error: "This browser would not let the handoff be saved (storage is full or blocked)." };
  }
  recordHandoff({ direction: "pulled", code: "", device: snapshot.device, memo: snapshot.memo, keysCount: entries.length });
  window.location.reload();
  return { ok: true, count: entries.length };
}

/* ---------- the cloud vault ---------- */

export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);

export const isCode = (raw: string) => CODE_PATTERN.test(raw);

export async function pushSnapshot(snapshot: HandoffSnapshot): Promise<PushResult> {
  try {
    const res = await fetch("/api/device-handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      cache: "no-store",
    });
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null) {
      const b = body as Partial<PushResult & { error: string }>;
      if (b.ok === true && typeof b.code === "string" && typeof b.expiresAt === "number") {
        recordHandoff({
          direction: "pushed",
          code: b.code,
          device: snapshot.device,
          memo: snapshot.memo,
          keysCount: snapshot.keysCount,
        });
        return { ok: true, code: b.code, expiresAt: b.expiresAt };
      }
      if (typeof b.error === "string") return { ok: false, error: b.error };
    }
    return { ok: false, error: "The vault returned an answer this app did not understand." };
  } catch {
    return { ok: false, error: "Could not reach the handoff vault. Download the .json file instead." };
  }
}

export async function pullSnapshot(code: string): Promise<PullResult> {
  if (!isCode(code)) return { ok: false, error: `Enter the ${CODE_LENGTH}-character code shown on the other device.` };
  try {
    const res = await fetch(`/api/device-handoff?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null) {
      const b = body as { ok?: boolean; snapshot?: unknown; error?: unknown };
      if (b.ok === true && isSnapshot(b.snapshot)) return { ok: true, snapshot: b.snapshot };
      if (typeof b.error === "string") return { ok: false, error: b.error };
    }
    return { ok: false, error: "The vault returned an answer this app did not understand." };
  } catch {
    return { ok: false, error: "Could not reach the handoff vault. Check that the other device is on the same app." };
  }
}

// Called once the snapshot has landed, so a stale copy is not left sitting in the vault.
export async function burnSnapshot(code: string): Promise<void> {
  if (!isCode(code)) return;
  try {
    await fetch(`/api/device-handoff?code=${encodeURIComponent(code)}`, { method: "DELETE", cache: "no-store" });
  } catch {
    // it expires on its own anyway
  }
}

/* ---------- the offline fallback ---------- */

export const snapshotFilename = (snapshot: HandoffSnapshot) =>
  `collab-handoff-${snapshot.device.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${snapshot.createdAt.slice(0, 10)}.json`;

export function downloadSnapshot(snapshot: HandoffSnapshot): void {
  downloadFile(snapshotFilename(snapshot), JSON.stringify(snapshot, null, 2), "application/json;charset=utf-8");
}

export function parseSnapshotFile(fileText: string): PullResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText.replace(/^﻿/, ""));
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!isSnapshot(parsed)) return { ok: false, error: "That file is not a device handoff from this app." };
  return { ok: true, snapshot: parsed };
}

/* ---------- the memory vault log ---------- */

const EMPTY: HandoffLogEntry[] = [];
const DIRECTIONS: readonly string[] = ["pushed", "pulled"];

const isLogEntry = (value: unknown): value is HandoffLogEntry => {
  if (typeof value !== "object" || value === null) return false;
  const e = value as HandoffLogEntry;
  return (
    typeof e.id === "string" &&
    typeof e.ts === "number" &&
    DIRECTIONS.includes(e.direction) &&
    typeof e.code === "string" &&
    typeof e.device === "string" &&
    typeof e.memo === "string" &&
    typeof e.keysCount === "number"
  );
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// useSyncExternalStore needs a referentially stable snapshot, so the parsed list is cached per raw string.
let cachedRaw: string | null = null;
let cachedLog: HandoffLogEntry[] = EMPTY;

export function getHandoffLog(): HandoffLogEntry[] {
  const raw = read(LOG_KEY);
  if (raw === cachedRaw) return cachedLog;
  cachedRaw = raw;
  cachedLog = EMPTY;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) cachedLog = parsed.filter(isLogEntry).slice(0, MAX_LOG);
    } catch {
      // corrupt JSON: start over
    }
  }
  return cachedLog;
}

// Newest first, capped at 12 entries. The memo is the actual payload here: it is what the next device reads.
export function recordHandoff(entry: Omit<HandoffLogEntry, "id" | "ts">): void {
  const next: HandoffLogEntry = { id: crypto.randomUUID(), ts: Date.now(), ...entry };
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify([next, ...getHandoffLog()].slice(0, MAX_LOG)));
  } catch {
    return; // storage blocked: nothing to log to
  }
  notify();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function useHandoffLog(): HandoffLogEntry[] {
  return useSyncExternalStore(subscribe, getHandoffLog, () => EMPTY);
}

export function useDeviceName(): string {
  return useSyncExternalStore(subscribe, getDeviceName, () => "This device");
}
