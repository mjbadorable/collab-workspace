import { supabase } from "@/lib/supabase";

// The cloud half of the device handoff: a short-lived locker that holds one device's workspace snapshot until
// the other device fetches it with the code.
//
// When Supabase is configured the snapshot is stored in the device_handoffs table, so a code survives cold
// starts, redeploys and requests that land on a different serverless instance. The module-level map below is
// the hot cache in front of it and the whole fallback when Supabase is missing or unreachable (per instance,
// lost on a cold start). The modal always offers the .json file as the durable fallback of last resort.

const TTL_MS = 30 * 60_000;
const MAX_ENTRIES = 20;
// A snapshot is JSON copied straight out of localStorage, so a few hundred KB is already generous.
const MAX_BODY_BYTES = 2_000_000;
const MAX_DEVICE_NAME = 40;
const MAX_MEMO = 500;
const KEY_PREFIX = "collab-workspace:";
const SNAPSHOT_VERSION = 1;

// No I, O, 0 or 1: a code gets read out loud or typed on a phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

// Guessing a code is 32^6 tries, but a wrong guess should still get slower rather than free.
const LOOKUP_WINDOW_MS = 10 * 60_000;
const MAX_FAILED_LOOKUPS = 30;

type Snapshot = {
  version: number;
  device: string;
  memo: string;
  createdAt: string;
  keysCount: number;
  data: Record<string, string>;
};

type Entry = { snapshot: Snapshot; expiresAt: number };

const vault = new Map<string, Entry>();
const failedLookups = new Map<string, { count: number; resetAt: number }>();

const fail = (error: string, status = 200) => Response.json({ ok: false, error }, { status });

function sweep(now: number) {
  for (const [code, entry] of vault) if (entry.expiresAt <= now) vault.delete(code);
  for (const [ip, hits] of failedLookups) if (hits.resetAt <= now) failedLookups.delete(ip);
}

// Only ever used to bucket rate-limit counters; it is a hint, not an identity.
const clientKey = (request: Request) =>
  (request.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || request.headers.get("x-real-ip") || "local";

function tooManyLookups(request: Request, now: number): boolean {
  const hits = failedLookups.get(clientKey(request));
  return hits !== undefined && hits.resetAt > now && hits.count >= MAX_FAILED_LOOKUPS;
}

function noteFailedLookup(request: Request, now: number) {
  const key = clientKey(request);
  const hits = failedLookups.get(key);
  if (hits && hits.resetAt > now) hits.count += 1;
  else failedLookups.set(key, { count: 1, resetAt: now + LOOKUP_WINDOW_MS });
}

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = "";
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  // Astronomically unlikely, and cheap to rule out.
  return vault.has(code) ? newCode() : code;
}

// Rejects anything that is not this app's own snapshot, so the locker can never be used as a general file host.
function isSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<Snapshot>;
  return (
    s.version === SNAPSHOT_VERSION &&
    typeof s.device === "string" &&
    s.device.length <= MAX_DEVICE_NAME &&
    typeof s.memo === "string" &&
    s.memo.length <= MAX_MEMO &&
    typeof s.createdAt === "string" &&
    s.createdAt.length <= 40 &&
    typeof s.keysCount === "number" &&
    typeof s.data === "object" &&
    s.data !== null &&
    !Array.isArray(s.data) &&
    Object.entries(s.data).every(([key, v]) => key.startsWith(KEY_PREFIX) && typeof v === "string")
  );
}

// Push: store a snapshot and hand back the code to type on the other device.
export async function POST(request: Request) {
  const now = Date.now();
  sweep(now);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return fail("That workspace snapshot is too large to hand off through the cloud. Use the .json download instead.", 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail("Send a JSON snapshot.", 400);
  }
  if (!isSnapshot(parsed)) return fail("That is not a Collab Workspace handoff snapshot.", 400);

  // The locker is small on purpose: an old handoff nobody collected makes room for the new one.
  if (vault.size >= MAX_ENTRIES) {
    const oldest = [...vault.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) vault.delete(oldest[0]);
  }

  const code = newCode();
  const expiresAt = now + TTL_MS;
  if (supabase) {
    try {
      // supabase-js reports failures in the result rather than throwing; either way the memory vault still has it.
      await supabase.from("device_handoffs").insert({
        code,
        snapshot: parsed,
        memo: parsed.memo || null,
        source_device: parsed.device || null,
        expires_at: new Date(expiresAt).toISOString(),
      });
    } catch {
      // Graceful fallback to memory vault
    }
  }
  vault.set(code, { snapshot: parsed, expiresAt });
  return Response.json({ ok: true, code, expiresAt });
}

// Pull: hand the snapshot to the receiving device. It stays in the locker until it expires or is burned, so a
// failed restore can be retried with the same code.
export async function GET(request: Request) {
  const now = Date.now();
  sweep(now);

  if (tooManyLookups(request, now)) return fail("Too many wrong codes. Wait a few minutes and try again.", 429);

  const code = new URL(request.url).searchParams.get("code")?.toUpperCase() ?? "";
  if (!CODE_PATTERN.test(code)) return fail(`A handoff code is ${CODE_LENGTH} characters.`, 400);

  if (supabase) {
    try {
      const { data } = await supabase
        .from("device_handoffs")
        .select("snapshot, expires_at")
        .eq("code", code)
        .gt("expires_at", new Date(now).toISOString())
        .maybeSingle();

      if (data && isSnapshot(data.snapshot)) {
        return Response.json({
          ok: true,
          snapshot: data.snapshot,
          expiresAt: new Date(data.expires_at).getTime(),
        });
      }
    } catch {
      // Fall through to memory lookup
    }
  }

  const entry = vault.get(code);
  if (!entry) {
    noteFailedLookup(request, now);
    return fail("No handoff is waiting under that code. It may have expired, already been collected, or the server restarted.", 404);
  }
  return Response.json({ ok: true, snapshot: entry.snapshot, expiresAt: entry.expiresAt });
}

// Burn: called by the receiving device once the snapshot is safely restored.
export async function DELETE(request: Request) {
  const now = Date.now();
  sweep(now);

  const code = new URL(request.url).searchParams.get("code")?.toUpperCase() ?? "";
  if (!CODE_PATTERN.test(code)) return fail(`A handoff code is ${CODE_LENGTH} characters.`, 400);
  let removed = false;
  if (supabase) {
    try {
      const { data } = await supabase.from("device_handoffs").delete().eq("code", code).select("code");
      removed = (data?.length ?? 0) > 0;
    } catch {
      // The memory vault below is still cleared.
    }
  }
  return Response.json({ ok: vault.delete(code) || removed });
}
