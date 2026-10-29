"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Copy, FileDown, FileUp, Laptop, Link2, RefreshCw, X } from "lucide-react";
import {
  applySnapshot,
  burnSnapshot,
  CODE_LENGTH,
  collectSnapshot,
  downloadSnapshot,
  isCode,
  MAX_MEMO,
  normalizeCode,
  parseSnapshotFile,
  pullSnapshot,
  pushSnapshot,
  setDeviceName,
  useDeviceName,
  useHandoffLog,
  type HandoffSnapshot,
} from "@/lib/device-handoff";

type Tab = "send" | "receive";
type Pushed = { code: string; expiresAt: number; keysCount: number };

const field =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";
const primary =
  "flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50";
const secondary =
  "flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50";

function minutesLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000));
}

// The 1-click link is the deployed app's address plus the code; the receiving app reads ?handoff= on load.
const transferLink = (code: string) => `${window.location.origin}/?handoff=${code}`;

// localhost and loopback addresses only exist on the machine they were typed on.
const isLocalOrigin = () => ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) || window.location.hostname.endsWith(".localhost");

function CopyButton({ text, label, icon: Icon }: { text: string; label: string; icon: typeof Copy }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // clipboard blocked: the code is on screen to type by hand
        }
      }}
      className={secondary}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

function SnapshotPreview({ snapshot }: { snapshot: HandoffSnapshot }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <Laptop className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
        {snapshot.device}
        <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-600">
          {snapshot.keysCount} keys
        </span>
      </p>
      <p className="mt-1 text-xs text-neutral-500">Captured {new Date(snapshot.createdAt).toLocaleString()}</p>
      {snapshot.memo && <p className="mt-2 whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-2 text-xs text-neutral-700">{snapshot.memo}</p>}
    </div>
  );
}

function SendPanel() {
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [pushed, setPushed] = useState<Pushed | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The code is only good for half an hour, so the countdown is part of the instruction. It is derived from
  // the expiry below; this is only here to re-render the panel while the dialog sits open.
  const [, refresh] = useState(0);

  useEffect(() => {
    if (!pushed) return;
    const id = setInterval(() => refresh((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [pushed]);

  const push = async () => {
    setBusy(true);
    setError(null);
    const snapshot = collectSnapshot(memo);
    const result = await pushSnapshot(snapshot);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPushed({ code: result.code, expiresAt: result.expiresAt, keysCount: snapshot.keysCount });
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-neutral-700">Session memo — where you are leaving off</span>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value.slice(0, MAX_MEMO))}
          rows={3}
          placeholder="Shipped CW-41. Next: wire Supabase auth, then push the branch."
          className={`${field} mt-1 resize-y`}
        />
        <span className="mt-0.5 block text-right text-[11px] text-neutral-400">
          {memo.length}/{MAX_MEMO}
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={push} disabled={busy} className={primary}>
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUpFromLine className="h-4 w-4" aria-hidden />}
          {busy ? "Pushing…" : "Push to Cloud Vault"}
        </button>
        <button type="button" onClick={() => downloadSnapshot(collectSnapshot(memo))} className={secondary}>
          <FileDown className="h-4 w-4" aria-hidden /> Download .json
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {pushed && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-900">
            {pushed.keysCount} workspace keys are waiting in the vault. Type this code on the other device, or send it the link:
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p
              className="rounded-lg border border-emerald-300 bg-white px-3 py-2 font-mono text-2xl font-bold tracking-[0.3em] text-emerald-800"
              aria-label={`Handoff code ${pushed.code.split("").join(" ")}`}
            >
              {pushed.code}
            </p>
            <p className="text-xs text-emerald-800">
              Expires in {minutesLeft(pushed.expiresAt)} min
              <br />
              <span className="text-emerald-700">{new Date(pushed.expiresAt).toLocaleTimeString()}</span>
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton text={pushed.code} label="Copy Code" icon={Copy} />
            <CopyButton text={transferLink(pushed.code)} label="Copy 1-Click Link" icon={Link2} />
          </div>
          {isLocalOrigin() && (
            <p className="mt-2 text-[11px] text-emerald-800">
              This app is open on localhost, so the link only works on this machine. On your other device, open the
              deployed app and type the code instead.
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-neutral-500">
        The vault holds the snapshot in server memory for 30 minutes. A redeploy or a cold start clears it, so for a
        handoff you cannot repeat, take the .json file with you.
      </p>
    </div>
  );
}

function ReceivePanel({ initialCode }: { initialCode?: string }) {
  const startCode = initialCode ? normalizeCode(initialCode) : "";
  const [code, setCode] = useState(startCode);
  // A valid code from a transfer link is fetched straight away, so the panel opens already loading.
  const [busy, setBusy] = useState(isCode(startCode));
  const [error, setError] = useState<string | null>(
    startCode && !isCode(startCode) ? `"${startCode}" is not a valid handoff code. Check the link or type the code again.` : null
  );
  const [incoming, setIncoming] = useState<{ snapshot: HandoffSnapshot; code: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isCode(startCode)) return;
    let cancelled = false;
    pullSnapshot(startCode).then((result) => {
      if (cancelled) return;
      setBusy(false);
      if (result.ok) setIncoming({ snapshot: result.snapshot, code: startCode });
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [startCode]);

  const fetchByCode = async () => {
    setBusy(true);
    setError(null);
    const result = await pullSnapshot(code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setIncoming({ snapshot: result.snapshot, code });
  };

  const openFile = async (file: File) => {
    setError(null);
    const result = parseSnapshotFile(await file.text());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setIncoming({ snapshot: result.snapshot, code: "" });
  };

  // Writes the snapshot over this device's workspace keys and reloads; the vault copy is burned afterwards so a
  // collected handoff cannot be restored twice by accident.
  const restore = () => {
    if (!incoming) return;
    const result = applySnapshot(incoming.snapshot);
    if (!result.ok) {
      setError(result.error ?? "The handoff could not be restored.");
      return;
    }
    if (incoming.code) void burnSnapshot(incoming.code);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-xs font-medium text-neutral-700">Handoff code from the other device</span>
          <input
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && code.length === CODE_LENGTH && void fetchByCode()}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC234"
            className={`${field} mt-1 w-40 font-mono text-lg uppercase tracking-[0.25em]`}
          />
        </label>
        <button type="button" onClick={fetchByCode} disabled={busy || code.length !== CODE_LENGTH} className={primary}>
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowDownToLine className="h-4 w-4" aria-hidden />}
          {busy ? "Fetching…" : "Fetch handoff"}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={secondary}>
          <FileUp className="h-4 w-4" aria-hidden /> Open .json
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void openFile(file);
          }}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {incoming && (
        <div className="space-y-2">
          <SnapshotPreview snapshot={incoming.snapshot} />
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Restoring overwrites the {incoming.snapshot.keysCount} workspace keys this snapshot carries and reloads the
            page. This device&apos;s name and handoff history are kept.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={restore} className={primary}>
              <ArrowDownToLine className="h-4 w-4" aria-hidden /> Restore Snapshot
            </button>
            <button type="button" onClick={() => setIncoming(null)} className={secondary}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VaultLog() {
  const log = useHandoffLog();
  if (log.length === 0) {
    return <p className="text-xs text-neutral-500">No handoffs yet. Push one from the device you are leaving.</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
      {log.map((entry) => (
        <li key={entry.id} className="px-3 py-2">
          <p className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
                entry.direction === "pushed" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {entry.direction}
            </span>
            <span className="font-medium">{entry.device}</span>
            {entry.code && <span className="font-mono text-neutral-500">{entry.code}</span>}
            <span className="ml-auto text-neutral-500">{new Date(entry.ts).toLocaleString()}</span>
          </p>
          {entry.memo && <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{entry.memo}</p>}
        </li>
      ))}
    </ul>
  );
}

function DeviceNameField() {
  const stored = useDeviceName();
  const [draft, setDraft] = useState(stored);

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-medium text-neutral-700">This device</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setDeviceName(draft)}
        onKeyDown={(e) => e.key === "Enter" && setDeviceName(draft)}
        placeholder="Edtech-03"
        className={`${field} w-40`}
      />
    </label>
  );
}

const tabClass = (active: boolean) =>
  `flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-600 hover:text-neutral-900"
  }`;

// Mounted only while the dialog is open, so the starting tab follows initialCode each time it opens.
function Body({ onClose, initialCode }: { onClose: () => void; initialCode?: string }) {
  const [tab, setTab] = useState<Tab>(initialCode ? "receive" : "send");

  return (
    <div className="max-h-[85vh] overflow-y-auto p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">📡 Cloud Device Handoff</h2>
          <p className="mt-0.5 text-xs text-neutral-500">Carry this session to your other machine, memo and all.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
        <DeviceNameField />
      </div>

      <div role="tablist" aria-label="Handoff direction" className="mt-3 flex gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1">
        <button type="button" role="tab" aria-selected={tab === "send"} onClick={() => setTab("send")} className={tabClass(tab === "send")}>
          Send from here
        </button>
        <button type="button" role="tab" aria-selected={tab === "receive"} onClick={() => setTab("receive")} className={tabClass(tab === "receive")}>
          Receive here
        </button>
      </div>

      <div className="mt-3">{tab === "send" ? <SendPanel /> : <ReceivePanel initialCode={initialCode} />}</div>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Memory vault</h3>
      <div className="mt-2">
        <VaultLog />
      </div>
    </div>
  );
}

// Moves a whole working session between machines (office PC ⇄ laptop): every workspace key on this device plus
// a memo about where the work stopped, parked in the cloud vault under a 6-character code (or a link carrying
// it) or carried as a .json file. The vault log below is the memory trail of what was handed over and when.
// initialCode comes from a ?handoff= link: the modal opens on Receive with the code already fetched.
export default function DeviceHandoffModal({
  open,
  onClose,
  initialCode,
}: {
  open: boolean;
  onClose: () => void;
  initialCode?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Cloud device handoff"
      className="m-auto w-full max-w-lg rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {/* Rendered only while open: the panels read localStorage, which the server has no copy of. */}
      {open && <Body onClose={onClose} initialCode={initialCode} />}
    </dialog>
  );
}
