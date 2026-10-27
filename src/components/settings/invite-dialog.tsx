"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Link2 } from "lucide-react";
import type { WorkspaceMember } from "@/lib/database.types";
import { INVITE_LINK, inviteMember } from "@/lib/members";
import { useWorkspaces } from "@/lib/workspace-context";

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

function InviteForm({ onClose, onInvited }: { onClose: () => void; onInvited?: () => void }) {
  const { current } = useWorkspaces();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceMember["role"]>("member");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    const message = await inviteMember(current.id, email, role);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    setSuccess(true);
    setEmail("");
    onInvited?.();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INVITE_LINK);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(`Could not copy automatically. Share this link: ${INVITE_LINK}`);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold">Invite member</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {current
            ? `Add a teammate to ${current.name}. They need an account first.`
            : "Sign in to a cloud workspace to invite teammates."}
        </p>
      </div>
      <div>
        <label htmlFor="invite-email" className="mb-1 block text-xs font-medium text-neutral-600">
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          required
          autoFocus
          disabled={!current}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="invite-role" className="mb-1 block text-xs font-medium text-neutral-600">
          Role
        </label>
        <select
          id="invite-role"
          disabled={!current}
          value={role}
          onChange={(e) => setRole(e.target.value as WorkspaceMember["role"])}
          className={fieldClass}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-sm text-emerald-800">
          Member added successfully!
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
          {copied ? "Copied!" : "Copy invite link"}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
            Close
          </button>
          <button
            type="submit"
            disabled={busy || !current}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add member"}
          </button>
        </div>
      </div>
    </form>
  );
}

// Controlled by the caller (the settings page, or the sidebar via AppShell). Esc, backdrop click and Close all call onClose.
export default function InviteDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Invite member"
      className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {open && <InviteForm onClose={onClose} onInvited={onInvited} />}
    </dialog>
  );
}
