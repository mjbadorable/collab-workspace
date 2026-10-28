import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  avatarUrl: string | null;
  text: string;
  createdAt: string;
};

export type RoomProfile = { id: string; name: string; role: string; avatarUrl: string | null };

const MAX_MESSAGES = 100;
const MAX_MESSAGE_CHARS = 2000;
const MAX_PAD_CHARS = 50_000;
const PAD_BROADCAST_DELAY_MS = 400;

const chatKey = (projectId: string) => `collab-workspace:team-chat:${projectId}`;
const padKey = (projectId: string) => `collab-workspace:scratchpad:${projectId}`;

// ---------------------------------------------------------------- local stores
// The device copy of the chat and the scratchpad. In local preview it is the whole story (other tabs see changes
// through the "storage" event); signed in, it is also this device's history of what the room has said.

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribeStore(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return; // storage blocked: the change is lost on reload
  }
  notify();
}

const EMPTY_MESSAGES: ChatMessage[] = [];
const chatCache = new Map<string, { raw: string | null; list: ChatMessage[] }>();

const isMessage = (v: unknown): v is ChatMessage => {
  if (typeof v !== "object" || v === null) return false;
  const m = v as ChatMessage;
  return (
    typeof m.id === "string" &&
    typeof m.authorId === "string" &&
    typeof m.authorName === "string" &&
    typeof m.authorRole === "string" &&
    (m.avatarUrl === null || typeof m.avatarUrl === "string") &&
    typeof m.text === "string" &&
    typeof m.createdAt === "string"
  );
};

// useSyncExternalStore needs a referentially stable snapshot, so each project's parsed list is cached per raw string.
function readMessages(projectId: string): ChatMessage[] {
  const raw = readRaw(chatKey(projectId));
  const hit = chatCache.get(projectId);
  if (hit && hit.raw === raw) return hit.list;
  let list = EMPTY_MESSAGES;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.filter(isMessage);
    } catch {
      // corrupt JSON: start over
    }
  }
  chatCache.set(projectId, { raw, list });
  return list;
}

function appendMessage(projectId: string, message: ChatMessage) {
  const current = readMessages(projectId);
  if (current.some((m) => m.id === message.id)) return;
  writeRaw(chatKey(projectId), JSON.stringify([...current, message].slice(-MAX_MESSAGES)));
}

// ---------------------------------------------------------------- Supabase room (broadcast + presence)
// One channel per workspace + project, shared by the chat and the scratchpad hooks. Broadcast is not stored by
// Supabase: a teammate who joins later only sees what is said while they are there.

type RoomListener = {
  onMessage: (message: ChatMessage) => void;
  onScratchpad: (text: string) => void;
  onPresence: (online: number) => void;
  onConnected: (connected: boolean) => void;
};

type Room = { channel: RealtimeChannel; listeners: Set<RoomListener>; online: number; connected: boolean };

const rooms = new Map<string, Room>();

function joinRoom(workspaceId: string, projectId: string, me: RoomProfile, listener: RoomListener): () => void {
  const client = supabase;
  if (!client) return () => undefined;
  const key = `${workspaceId}:${projectId}`;
  let room = rooms.get(key);

  if (!room) {
    // The workspace id is part of the name so two workspaces that both have a "collab-workspace" project stay apart.
    const channel = client.channel(`team_room:${workspaceId}:${projectId}`, {
      config: { presence: { key: me.id }, broadcast: { self: false } },
    });
    const created: Room = { channel, listeners: new Set(), online: 0, connected: false };
    channel
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        if (isMessage(payload)) created.listeners.forEach((l) => l.onMessage(payload));
      })
      .on("broadcast", { event: "scratchpad_update" }, ({ payload }) => {
        const text = (payload as { text?: unknown } | null)?.text;
        if (typeof text === "string") created.listeners.forEach((l) => l.onScratchpad(text.slice(0, MAX_PAD_CHARS)));
      })
      .on("presence", { event: "sync" }, () => {
        created.online = Object.keys(channel.presenceState()).length;
        created.listeners.forEach((l) => l.onPresence(created.online));
      })
      .subscribe((status) => {
        created.connected = status === "SUBSCRIBED";
        if (created.connected) void channel.track({ id: me.id, name: me.name });
        created.listeners.forEach((l) => l.onConnected(created.connected));
      });
    rooms.set(key, created);
    room = created;
  }

  room.listeners.add(listener);
  listener.onConnected(room.connected);
  listener.onPresence(room.online);

  const joined = room;
  return () => {
    joined.listeners.delete(listener);
    if (joined.listeners.size === 0) {
      rooms.delete(key);
      void client.removeChannel(joined.channel);
    }
  };
}

function broadcast(workspaceId: string | null, projectId: string, event: "new_message" | "scratchpad_update", payload: object) {
  if (!workspaceId) return;
  const room = rooms.get(`${workspaceId}:${projectId}`);
  if (room?.connected) void room.channel.send({ type: "broadcast", event, payload });
}

// ---------------------------------------------------------------- hooks

// A hook's view of the room: how many people are in it and whether the live connection is up.
function useRoomStatus(workspaceId: string | null, projectId: string, me: RoomProfile, handlers: Partial<RoomListener>) {
  const [online, setOnline] = useState(0);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  const meRef = useRef(me);

  useEffect(() => {
    handlersRef.current = handlers;
    meRef.current = me;
  });

  useEffect(() => {
    if (!workspaceId || !supabase) return;
    const leave = joinRoom(workspaceId, projectId, meRef.current, {
      onMessage: (m) => handlersRef.current.onMessage?.(m),
      onScratchpad: (t) => handlersRef.current.onScratchpad?.(t),
      onPresence: setOnline,
      onConnected: setConnected,
    });
    return leave;
  }, [workspaceId, projectId]);

  return workspaceId ? { online, connected } : { online: 0, connected: false };
}

// The project's chat. Signed in (workspaceId set) messages are also broadcast to everyone in the room.
export function useTeamChat(projectId: string, profile: RoomProfile, workspaceId: string | null = null) {
  const messages = useSyncExternalStore(
    subscribeStore,
    () => readMessages(projectId),
    () => EMPTY_MESSAGES
  );
  const status = useRoomStatus(workspaceId, projectId, profile, {
    onMessage: (m) => appendMessage(projectId, m),
  });

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim().slice(0, MAX_MESSAGE_CHARS);
      if (!trimmed) return;
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        authorId: profile.id,
        authorName: profile.name,
        authorRole: profile.role,
        avatarUrl: profile.avatarUrl,
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      appendMessage(projectId, message);
      broadcast(workspaceId, projectId, "new_message", message);
    },
    [projectId, workspaceId, profile.id, profile.name, profile.role, profile.avatarUrl]
  );

  return { messages, send, ...status };
}

// The project's shared markdown note. Edits save at once and, signed in, reach the room a moment later
// (the last edit wins; there is no merging).
export function useScratchpad(projectId: string, workspaceId: string | null = null, profile?: RoomProfile) {
  const text = useSyncExternalStore(
    subscribeStore,
    () => readRaw(padKey(projectId)) ?? "",
    () => ""
  );
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const me = profile ?? { id: "local", name: "You", role: "", avatarUrl: null };
  const status = useRoomStatus(workspaceId, projectId, me, {
    onScratchpad: (t) => writeRaw(padKey(projectId), t),
  });

  useEffect(() => () => clearTimeout(timer.current), []);

  const setText = useCallback(
    (next: string) => {
      const clipped = next.slice(0, MAX_PAD_CHARS);
      writeRaw(padKey(projectId), clipped);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => broadcast(workspaceId, projectId, "scratchpad_update", { text: clipped }), PAD_BROADCAST_DELAY_MS);
    },
    [projectId, workspaceId]
  );

  return { text, setText, ...status };
}
