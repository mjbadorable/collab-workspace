"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";
import { exportFullWorkspaceBackup, restoreFullWorkspaceBackup } from "@/lib/workspace-backup";
import { useAuth } from "@/lib/auth-context";
import { fetchMembers, type Member } from "@/lib/members";
import { initials, mockUser, mockWorkspace } from "@/lib/mock-data";
import { useIsClient } from "@/lib/use-is-client";
import { useWorkspacePermissions } from "@/lib/use-permissions";
import { useWorkspaces } from "@/lib/workspace-context";
import InviteDialog from "./invite-dialog";
import ProfileForm from "./profile-form";

type Tab = "profile" | "general" | "members";

const tabs: { value: Tab; label: string }[] = [
  { value: "profile", label: "Profile" },
  { value: "general", label: "General" },
  { value: "members", label: "Members" },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

function Field({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-sm">{children}</p>
    </div>
  );
}

function Profile() {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold">Profile</h2>
      <div className="max-w-md">
        <ProfileForm showBadges />
      </div>
    </div>
  );
}

// Everything this app keeps on the device (boards, runbooks, cycles, chat, settings) as one .json file.
function BackupSection() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const restore = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    if (!window.confirm("This will restore all workspace settings, runbooks, and items on this device. Continue?")) return;
    const result = await restoreFullWorkspaceBackup(await file.text());
    setMessage(
      result.ok
        ? { ok: true, text: `Restored ${result.count} items. Reloading…` }
        : { ok: false, text: result.error ?? "The backup could not be restored." }
    );
  };

  return (
    <div className="max-w-md rounded-lg border border-neutral-200 p-4">
      <h3 className="text-sm font-semibold">Workspace Backup &amp; Cross-Device Migration</h3>
      <p className="mt-1 text-sm text-neutral-500">
        Save everything stored on this device as one file, and restore it on another device or browser. The file includes
        chat history and any webhook URLs, so keep it private.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportFullWorkspaceBackup}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Download className="h-4 w-4" aria-hidden /> Export Workspace Snapshot
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
          <Upload className="h-4 w-4" aria-hidden /> Restore Snapshot
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => {
              const input = e.currentTarget;
              void restore(input.files?.[0]).finally(() => {
                input.value = "";
              });
            }}
          />
        </label>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-3 rounded-md px-2.5 py-1.5 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function General() {
  const { user } = useAuth();
  const { current } = useWorkspaces();
  const { isAdmin, loading } = useWorkspacePermissions(user && current ? current.id : null);
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold">General</h2>
      {current ? (
        <div className="grid max-w-md gap-4">
          <Field label="Workspace name">{current.name}</Field>
          <Field label="Slug">{current.slug}</Field>
          <Field label="Created">{formatDate(current.created_at)}</Field>
        </div>
      ) : (
        <div className="grid max-w-md gap-4">
          <Field label="Workspace name">{mockWorkspace.name}</Field>
          <p className="text-sm text-neutral-500">
            This is the local preview workspace.{" "}
            <Link href="/login" className="text-indigo-600 hover:underline">
              Sign in
            </Link>{" "}
            to manage a cloud workspace.
          </p>
        </div>
      )}

      <BackupSection />

      <div className="max-w-md rounded-lg border border-red-200 p-4">
        <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
        <p className="mt-1 text-sm text-neutral-500">Deleting a workspace removes all of its projects and data.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Deleting a workspace is not built yet, so the button stays disabled even for admins. */}
          <button
            type="button"
            disabled
            title={isAdmin ? "Coming in a later milestone" : undefined}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 opacity-50"
          >
            Delete workspace
          </button>
          {!isAdmin && (
            <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
              {loading ? "Checking your role…" : "Admin role required to delete workspaces"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Members({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMembers(workspaceId).then(
      (rows) => {
        if (cancelled) return;
        setMembers(rows);
        setError(null);
      },
      (e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load members.");
        setMembers((prev) => prev ?? []);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [workspaceId, reloadKey]);

  const isAdmin = members?.some((m) => m.user_id === user?.id && m.role === "admin") ?? false;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Members</h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setInviting(true)}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" aria-hidden /> Invite member
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {members === null ? (
        <p className="mt-6 py-12 text-center text-sm text-neutral-500">Loading members…</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {initials((m.email ?? "?").split("@")[0].replace(/[._-]+/g, " "))}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.email}
                  {m.user_id === user?.id && <span className="ml-2 text-xs font-normal text-neutral-400">(you)</span>}
                </p>
                <p className="text-xs text-neutral-500">Joined {formatDate(m.joined_at)}</p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  m.role === "admin"
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-neutral-200 bg-neutral-100 text-neutral-700"
                }`}
              >
                {m.role === "admin" ? "Admin" : "Member"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <InviteDialog open={inviting} onClose={() => setInviting(false)} onInvited={() => setReloadKey((k) => k + 1)} />
    </div>
  );
}

function LocalMembers() {
  return (
    <div>
      <h2 className="text-base font-semibold">Members</h2>
      <ul className="mt-4 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        <li className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
            {initials(mockUser.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{mockUser.email}</p>
            <p className="text-xs text-neutral-500">Local preview</p>
          </div>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            Admin
          </span>
        </li>
      </ul>
      <p className="mt-4 text-sm text-neutral-500">
        <Link href="/login" className="text-indigo-600 hover:underline">
          Sign in
        </Link>{" "}
        to invite teammates to a cloud workspace.
      </p>
    </div>
  );
}

export default function WorkspaceSettingsView() {
  const mounted = useIsClient();
  const { user } = useAuth();
  const { current, loading } = useWorkspaces();
  const [tab, setTab] = useState<Tab>("profile");

  if (!mounted || loading) return <div className="h-full" />;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold">Workspace settings</h1>
      <div className="mt-6 flex flex-col gap-6 md:flex-row">
        <nav aria-label="Settings" className="flex shrink-0 gap-1 md:w-44 md:flex-col">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-current={tab === t.value ? "page" : undefined}
              onClick={() => setTab(t.value)}
              className={`rounded-md px-2.5 py-1.5 text-left text-sm ${
                tab === t.value ? "bg-neutral-200 font-medium text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {tab === "profile" ? (
            <Profile />
          ) : tab === "general" ? (
            <General />
          ) : user && current ? (
            // Remount per workspace so the list never shows another workspace's members.
            <Members key={current.id} workspaceId={current.id} />
          ) : (
            <LocalMembers />
          )}
        </div>
      </div>
    </div>
  );
}
