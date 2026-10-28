"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, Copy, MessageSquare, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { initials, mockUser } from "@/lib/mock-data";
import { useProfile } from "@/lib/profile-context";
import { useStorageTarget } from "@/lib/storage-target";
import { useScratchpad, useTeamChat, type RoomProfile } from "@/lib/team-room";

type Tab = "chat" | "pad";

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function Avatar({ name, url }: { name: string; url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- tiny data-URL thumbnail from user metadata
    <img src={url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
  ) : (
    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
      {initials(name) || "?"}
    </span>
  );
}

function Chat({ chat }: { chat: ReturnType<typeof useTeamChat> }) {
  const { messages, send } = chat;
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Stay at the newest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = () => {
    if (!draft.trim()) return;
    send(draft);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <li className="py-10 text-center text-sm text-neutral-500">No messages yet. Say hi to your team.</li>
        )}
        {messages.map((m) => (
          <li key={m.id} className="flex gap-2">
            <Avatar name={m.authorName} url={m.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
                <span className="font-semibold text-neutral-800">{m.authorName}</span>
                {m.authorRole && <span className="text-neutral-500">{m.authorRole}</span>}
                <time dateTime={m.createdAt} className="text-neutral-400">
                  {formatTime(m.createdAt)}
                </time>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm text-neutral-700">{m.text}</p>
            </div>
          </li>
        ))}
        <div ref={endRef} />
      </ul>
      <div className="flex items-end gap-2 border-t border-neutral-200 p-2">
        <label htmlFor="tr-message" className="sr-only">
          Message
        </label>
        <textarea
          id="tr-message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={2000}
          placeholder="Message the team… (Enter to send)"
          className="max-h-24 min-h-9 flex-1 resize-none rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        />
        <button type="button" onClick={submit} disabled={!draft.trim()} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  );
}

function Scratchpad({ pad, workspaceId }: { pad: ReturnType<typeof useScratchpad>; workspaceId: string | null }) {
  const { text, setText, connected, online } = pad;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the text stays selectable in the pad
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col p-2">
      <textarea
        aria-label="Shared scratchpad"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Runbooks, snippets, release notes…\n\nMarkdown is fine."}
        className="min-h-0 flex-1 resize-none rounded-md border border-neutral-300 bg-white p-2.5 font-mono text-xs leading-relaxed outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
      />
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-500">
        <span>
          {workspaceId ? (connected ? `Saved · live with ${Math.max(online - 1, 0)} other${online === 2 ? "" : "s"}` : "Saved · reconnecting…") : "Saved on this device · syncs across tabs"}
        </span>
        <button type="button" onClick={copy} disabled={!text} className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// Floating Team Room for one project: live chat and a shared scratchpad.
export default function TeamRoomDock({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { displayName, profile } = useProfile();
  const target = useStorageTarget();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");

  const workspaceId = user && target.mode === "cloud" ? target.workspaceId : null;
  // Only the small cloud thumbnail travels with a message, never the full local photo.
  const metaAvatar = (user?.user_metadata as Record<string, unknown> | undefined)?.avatar_url;
  const me: RoomProfile = {
    id: user?.id ?? mockUser.id,
    name: displayName,
    role: profile.role,
    avatarUrl: typeof metaAvatar === "string" ? metaAvatar : null,
  };
  // Both hooks live here, not in the tabs, so messages and pad edits keep arriving while the panel is closed
  // and the pill can show presence.
  const chat = useTeamChat(projectId, me, workspaceId);
  const pad = useScratchpad(projectId, workspaceId, me);
  const { online, connected } = pad;
  const live = workspaceId !== null && connected;

  // Esc closes the panel, unless a dialog is open (Esc belongs to that dialog then).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="no-print fixed bottom-4 right-4 z-30">
      {open ? (
        <section aria-label="Team Room" className="flex h-[480px] max-h-[calc(100vh-2rem)] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl">
          <header className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
            <h2 className="flex-1 text-sm font-semibold">💬 Team Room</h2>
            <span className="flex items-center gap-1.5 text-xs text-neutral-500" title={live ? "Connected to the live room" : "Local room"}>
              <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-neutral-400"}`} aria-hidden />
              {live ? `${online} online` : "Local"}
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Team Room" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
              <X className="h-4 w-4" />
            </button>
          </header>
          <div role="tablist" aria-label="Team Room" className="flex gap-1 border-b border-neutral-200 px-2 py-1.5">
            {(
              [
                ["chat", "Live Team Chat"],
                ["pad", "Shared Scratchpad"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`rounded-md px-2.5 py-1 text-xs ${tab === value ? "bg-neutral-200 font-medium text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "chat" ? <Chat chat={chat} /> : <Scratchpad pad={pad} workspaceId={workspaceId} />}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-lg hover:bg-neutral-50"
        >
          <MessageSquare className="h-4 w-4 text-red-600" aria-hidden />
          💬 Team Room
          <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-neutral-400"}`} aria-hidden title={live ? `${online} online` : "Local room"} />
        </button>
      )}
    </div>
  );
}
