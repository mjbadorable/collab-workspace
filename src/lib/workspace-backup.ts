import { localDateIso } from "./checklist";
import { downloadFile } from "./project-report";

const PREFIX = "collab-workspace:";
const BACKUP_VERSION = 1;

type Backup = { version: number; exportedAt: string; keysCount: number; data: Record<string, string> };

// Values are copied exactly as stored (they are strings), so a restore puts back byte-for-byte what was there.
export function exportFullWorkspaceBackup(): void {
  const data: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    }
  } catch {
    // storage blocked: the backup is whatever could be read
  }
  const backup: Backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    keysCount: Object.keys(data).length,
    data,
  };
  downloadFile(`collab-workspace-backup-${localDateIso()}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
}

function parseBackup(fileText: string): { data: Record<string, string> } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText.replace(/^﻿/, ""));
  } catch {
    return { error: "That file is not valid JSON." };
  }
  if (typeof parsed !== "object" || parsed === null) return { error: "That file is not a workspace backup." };
  const b = parsed as Partial<Backup>;
  if (b.version !== BACKUP_VERSION) return { error: "That backup was made by a different version and can't be restored here." };
  if (typeof b.data !== "object" || b.data === null || Array.isArray(b.data)) return { error: "That backup has no data in it." };

  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(b.data)) {
    // Only this app's own keys are ever written, whatever the file says.
    if (!key.startsWith(PREFIX)) return { error: `The backup contains a key that does not belong to this workspace: ${key.slice(0, 40)}` };
    if (typeof value !== "string") return { error: `The backup has an unreadable value for ${key}.` };
    data[key] = value;
  }
  return { data };
}

// Checks the file first and writes nothing unless all of it is valid. Keys already on this device that are not in
// the backup are left alone. On success the page reloads so every provider re-reads the restored data.
export async function restoreFullWorkspaceBackup(fileText: string): Promise<{ ok: boolean; count: number; error?: string }> {
  const result = parseBackup(fileText);
  if ("error" in result) return { ok: false, count: 0, error: result.error };

  const entries = Object.entries(result.data);
  try {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  } catch {
    return { ok: false, count: 0, error: "This browser would not let the backup be saved (storage is full or blocked)." };
  }
  window.location.reload();
  return { ok: true, count: entries.length };
}
