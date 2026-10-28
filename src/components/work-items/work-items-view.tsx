"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  ChevronRight,
  GitCommitHorizontal as GitCommit,
  GitPullRequest,
  Kanban,
  List,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  dueBadge,
  labelTone,
  metaFromParsed,
  parseDescription,
  serializeDescription,
  taskProgress,
  WORK_ITEM_LABELS,
  type SubTask,
  type TicketComment,
} from "@/lib/checklist";
import { getCycles } from "@/lib/cycles";
import { initials, mockUser } from "@/lib/mock-data";
import { startFocusTimer } from "@/lib/focus-timer";
import { getModules } from "@/lib/modules";
import { getProjects } from "@/lib/projects";
import { useProfile } from "@/lib/profile-context";
import { useStorageTarget } from "@/lib/storage-target";
import { useIsClient } from "@/lib/use-is-client";
import { useWorkspaceMembers } from "@/lib/use-permissions";
import { useWorkItems } from "@/lib/use-work-items";
import {
  projectIdentifier,
  workItemKey,
  type NewWorkItemInput,
  type StoredWorkItem,
  type Viewer,
  type WorkItemPriority,
  type WorkItemStatus,
} from "@/lib/work-items-storage";
import ImportExportDialog from "./import-export-dialog";
import { useNewWorkItem } from "./new-work-item-context";

type Filter = "all" | WorkItemStatus;
type ViewMode = "list" | "board";

// ?status=backlog | in_progress | done deep-links to a status; anything else is ignored.
const parseStatus = (value: string | null): WorkItemStatus | null => statusOptions.find((o) => o.value === value)?.value ?? null;

const VIEW_KEY = "collab-workspace:work-items-view";

const viewOptions: { value: ViewMode; label: string; icon: LucideIcon }[] = [
  { value: "list", label: "List", icon: List },
  { value: "board", label: "Board", icon: Kanban },
];

export const statusOptions: { value: WorkItemStatus; label: string; tone: string }[] = [
  { value: "backlog", label: "Backlog", tone: "border-neutral-200 bg-neutral-100 text-neutral-700" },
  { value: "in_progress", label: "In Progress", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  { value: "done", label: "Done", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
];

export const priorityOptions: { value: WorkItemPriority; label: string; tone: string; dot: string }[] = [
  { value: "low", label: "Low", tone: "border-neutral-200 text-neutral-600", dot: "bg-neutral-400" },
  { value: "medium", label: "Medium", tone: "border-blue-200 text-blue-700", dot: "bg-blue-500" },
  { value: "high", label: "High", tone: "border-red-200 text-red-700", dot: "bg-red-500" },
];

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  ...statusOptions.map(({ value, label }) => ({ value, label })),
];

function PillSelect<T extends string>({
  value,
  options,
  label,
  onChange,
  prefix,
}: {
  value: T;
  options: { value: T; label: string; tone: string }[];
  label: string;
  onChange: (next: T) => void;
  prefix?: ReactNode;
}) {
  const tone = options.find((o) => o.value === value)?.tone ?? "";
  return (
    <span className={`relative inline-flex items-center rounded-full border text-xs font-medium ${tone}`}>
      {prefix}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`cursor-pointer appearance-none rounded-full bg-transparent py-0.5 pr-2.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          prefix ? "pl-1" : "pl-2.5"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

type Me = { id: string; name: string };

// A workspace member who can be assigned work. Only the signed-in user has a photo (the profile avatar).
type Person = { id: string; name: string; avatar_url: string | null };

const nameFromEmail = (email: string) => email.split("@")[0].replace(/[._-]+/g, " ");

const formatCommentDate = (date: string) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

// A work item may carry a cycle or module that no longer exists; keep it selectable so saving does not drop it.
const withCurrent = (names: string[], current: string | null) => (current && !names.includes(current) ? [...names, current] : names);

// Unassigned, then me, then everyone else; a leftover assignee who is no longer a member keeps a label so the select stays valid.
function assigneeOptions(people: Person[], me: Me, currentId: string | null): { value: string; label: string }[] {
  const options = [
    { value: "", label: "Unassigned" },
    { value: me.id, label: `Assign to me (${me.name})` },
    ...people.filter((p) => p.id !== me.id).map((p) => ({ value: p.id, label: p.name })),
  ];
  if (currentId && !options.some((o) => o.value === currentId)) options.push({ value: currentId, label: "Former member" });
  return options;
}

// The assignee's avatar (photo or initials). The select laid over it is invisible but is what opens on click,
// so quick-assigning and re-assigning work with mouse, touch and keyboard.
function AssigneePicker({
  label,
  assigneeId,
  people,
  me,
  onChange,
}: {
  label: string;
  assigneeId: string | null;
  people: Person[];
  me: Me;
  onChange: (id: string | null) => void;
}) {
  const person = assigneeId ? people.find((p) => p.id === assigneeId) : undefined;
  const name = !assigneeId ? "Unassigned" : (person?.name ?? "Former member");
  return (
    <span className="relative inline-flex" title={`${name} (click to change)`}>
      {!assigneeId ? (
        <span className="rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-500">
          Unassigned
        </span>
      ) : person?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data-URL avatar
        <img src={person.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
          {initials(name) || "?"}
        </span>
      )}
      <select
        aria-label={label}
        value={assigneeId ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {assigneeOptions(people, me, assigneeId).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

// A teammate just changed this card/row: a brief indigo ring and pulse.
const REMOTE_FLASH = "animate-pulse bg-indigo-50 ring-2 ring-indigo-400";

const MAX_AVATARS = 3;

// "☑ 2/4" with a mini progress bar; emerald once every sub-task is checked. Renders nothing without sub-tasks.
// With `onToggle` it is a button (aria-expanded) that shows or hides the inline checklist.
function SubtaskPill({ tasks, expanded, onToggle }: { tasks: SubTask[]; expanded?: boolean; onToggle?: () => void }) {
  if (tasks.length === 0) return null;
  const { done, total, percent } = taskProgress(tasks);
  const complete = done === total;
  const className = `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${
    complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-neutral-200 bg-neutral-50 text-neutral-600"
  }`;
  const content = (
    <>
      <span aria-hidden>☑</span>
      <span className="tabular-nums">
        {done}/{total}
      </span>
      <span className="h-1 w-8 overflow-hidden rounded-full bg-neutral-200" aria-hidden>
        <span className={`block h-full ${complete ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${percent}%` }} />
      </span>
    </>
  );
  const title = `${done} of ${total} sub-tasks done`;
  return onToggle ? (
    <button type="button" onClick={onToggle} aria-expanded={expanded} title={title} className={`${className} cursor-pointer hover:brightness-95`}>
      {content}
    </button>
  ) : (
    <span title={title} className={className}>
      {content}
    </span>
  );
}

// Type label and due-date badges shown on cards and rows.
// Links into the project's repository; without a usable github_url the badge is shown but is not clickable.
function repoLink(githubUrl: string, path: string): string | null {
  return /^https?:\/\//i.test(githubUrl) ? `${githubUrl.replace(/\/+$/, "").replace(/\.git$/i, "")}/${path}` : null;
}

function GitBadge({ href, icon: Icon, children, title }: { href: string | null; icon: LucideIcon; children: ReactNode; title: string }) {
  const className =
    "inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-xs text-neutral-600";
  const content = (
    <>
      <Icon className="h-3 w-3" aria-hidden /> {children}
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={`${className} hover:border-indigo-300 hover:text-indigo-700`}>
      {content}
    </a>
  ) : (
    <span title={title} className={className}>
      {content}
    </span>
  );
}

type Parsed = ReturnType<typeof parseDescription>;

// True when a card or row has any badge to show besides the sub-task pill.
const hasMeta = (p: Parsed) =>
  Boolean(p.label || p.dueDate || p.cycle || p.module || p.commit || p.pr || p.blockedBy || p.comments.length > 0);

// `blockerStatus` is the status of the ticket named in [blocked-by], or null when that ticket is not on the board.
function ItemMeta({
  parsed,
  githubUrl,
  status,
  blockerStatus,
}: {
  parsed: Parsed;
  githubUrl: string;
  status: WorkItemStatus;
  blockerStatus: WorkItemStatus | null;
}) {
  const { label, dueDate, cycle, module, commit, pr, blockedBy, comments } = parsed;
  const due = dueBadge(dueDate, status);
  if (!hasMeta(parsed)) return null;
  return (
    <>
      {blockedBy &&
        (blockerStatus === null ? (
          <span title={`${blockedBy} is not on this board`} className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600">
            Blocked by {blockedBy} (not found)
          </span>
        ) : blockerStatus === "done" ? (
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            ✓ Unblocked ({blockedBy})
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            ⛔ Blocked by {blockedBy}
          </span>
        ))}
      {comments.length > 0 && (
        <span title={`${comments.length} ${comments.length === 1 ? "comment" : "comments"}`} className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600">
          💬 {comments.length}
        </span>
      )}
      {commit && (
        <GitBadge href={repoLink(githubUrl, `commit/${commit}`)} icon={GitCommit} title={`Commit ${commit}`}>
          #{commit.slice(0, 7)}
        </GitBadge>
      )}
      {pr && (
        <GitBadge href={repoLink(githubUrl, `pull/${pr}`)} icon={GitPullRequest} title={`Pull request #${pr}`}>
          PR #{pr}
        </GitBadge>
      )}
      {label && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${labelTone(label)}`}>{label}</span>}
      {cycle && (
        <span title={`Cycle: ${cycle}`} className="max-w-40 shrink-0 truncate rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600">
          🔁 {cycle}
        </span>
      )}
      {module && (
        <span title={`Module: ${module}`} className="max-w-40 shrink-0 truncate rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600">
          ▣ {module}
        </span>
      )}
      {due && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${due.tone}`}>{due.text}</span>}
    </>
  );
}

function LiveStatusBadge({ cloud, status }: { cloud: boolean; status: "connected" | "connecting" | "offline" }) {
  const live = cloud && status === "connected";
  const connecting = cloud && status !== "connected";
  const label = live ? "⚡ Live Sync" : connecting ? "Connecting..." : "Local Sync";
  const tip = live
    ? "Connected to real-time WebSockets"
    : connecting
      ? "Connecting to real-time WebSockets…"
      : "Local preview: syncs across tabs in this browser";
  return (
    <span
      role="status"
      title={tip}
      className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700"
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-emerald-500" : connecting ? "bg-amber-500" : "bg-neutral-400"}`}
        />
      </span>
      {label}
    </span>
  );
}

function PresenceAvatars({ viewers }: { viewers: Viewer[] }) {
  if (viewers.length === 0) return null;
  const shown = viewers.slice(0, MAX_AVATARS);
  const extra = viewers.length - shown.length;
  return (
    <ul aria-label="Teammates on this board" className="flex items-center -space-x-2">
      {shown.map((v) => (
        <li key={v.id} className="group relative">
          {v.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- tiny data-URL thumbnail from user metadata
            <img src={v.avatar_url} alt={v.name} className="h-7 w-7 rounded-full object-cover ring-2 ring-white" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700 ring-2 ring-white">
              {initials(v.name)}
              <span className="sr-only">{v.name}</span>
            </span>
          )}
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-white group-hover:block"
          >
            {v.name} · {v.role}
          </span>
        </li>
      ))}
      {extra > 0 && (
        <li className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-700 ring-2 ring-white">
          +{extra}
          <span className="sr-only"> more</span>
        </li>
      )}
    </ul>
  );
}

function WorkItemRow({
  item,
  projectId,
  me,
  people,
  githubUrl,
  statusByKey,
  remote,
  onChange,
  onEdit,
  onDelete,
  onFocus,
}: {
  item: StoredWorkItem;
  projectId: string;
  me: Me;
  people: Person[];
  githubUrl: string;
  statusByKey: ReadonlyMap<string, WorkItemStatus>;
  remote: boolean;
  onChange: (patch: Partial<StoredWorkItem>) => void;
  onEdit: () => void;
  onDelete: () => void;
  onFocus: () => void;
}) {
  const key = workItemKey(projectId, item.seq);
  const priority = priorityOptions.find((p) => p.value === item.priority)!;
  const parsed = parseDescription(item.description);
  const { notes, tasks } = parsed;
  const blockerStatus = parsed.blockedBy ? (statusByKey.get(parsed.blockedBy) ?? null) : null;

  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-neutral-100 px-4 py-2 transition-colors hover:bg-neutral-50 ${
        remote ? REMOTE_FLASH : ""
      }`}
    >
      <span className="w-16 shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-center font-mono text-xs text-neutral-600">
        {key}
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${key}`}
        className="min-w-48 flex-1 cursor-pointer text-left"
      >
        <p className={`truncate text-sm ${item.status === "done" ? "text-neutral-400 line-through" : ""}`}>
          {item.title}
        </p>
        {notes && <p className="truncate text-xs text-neutral-500">{notes}</p>}
      </button>
      <SubtaskPill tasks={tasks} />
      <ItemMeta parsed={parsed} githubUrl={githubUrl} status={item.status} blockerStatus={blockerStatus} />
      <PillSelect
        label={`Status of ${key}`}
        value={item.status}
        options={statusOptions}
        onChange={(status) => onChange({ status })}
      />
      <PillSelect
        label={`Priority of ${key}`}
        value={item.priority}
        options={priorityOptions}
        onChange={(p) => onChange({ priority: p })}
        prefix={<span className={`ml-2 h-1.5 w-1.5 rounded-full ${priority.dot}`} aria-hidden />}
      />
      <div className="w-24 shrink-0">
        <AssigneePicker
          label={`Assignee of ${key}`}
          assigneeId={item.assignee_id}
          people={people}
          me={me}
          onChange={(assignee_id) => onChange({ assignee_id })}
        />
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${key} details`}
        title="Edit"
        className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        <Pencil className="h-4 w-4" />
      </button>
      {item.status !== "done" && (
        <button
          type="button"
          onClick={onFocus}
          aria-label={`Focus on ${key}`}
          title="Start a 25-minute focus session on this item"
          className="shrink-0 rounded-md border border-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
        >
          🎯 Focus
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Move ${key} to trash`}
        title="Move to trash"
        className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

const columnDot: Record<WorkItemStatus, string> = {
  backlog: "bg-neutral-400",
  in_progress: "bg-amber-500",
  done: "bg-emerald-500",
};

function BoardCard({
  item,
  projectId,
  me,
  people,
  githubUrl,
  statusByKey,
  remote,
  onChange,
  onEdit,
  onDelete,
  onFocus,
}: {
  item: StoredWorkItem;
  projectId: string;
  me: Me;
  people: Person[];
  githubUrl: string;
  statusByKey: ReadonlyMap<string, WorkItemStatus>;
  remote: boolean;
  onChange: (patch: Partial<StoredWorkItem>) => void;
  onEdit: () => void;
  onDelete: () => void;
  onFocus: () => void;
}) {
  const key = workItemKey(projectId, item.seq);
  const priority = priorityOptions.find((p) => p.value === item.priority)!;
  const parsed = parseDescription(item.description);
  const { notes, tasks } = parsed;
  const blockerStatus = parsed.blockedBy ? (statusByKey.get(parsed.blockedBy) ?? null) : null;
  const [showTasks, setShowTasks] = useState(false);

  // Checking a sub-task rewrites the description in place, keeping the notes, label and due date.
  const toggleTask = (index: number) => {
    const next = tasks.map((t, i) => (i === index ? { ...t, done: !t.done } : t));
    onChange({ description: serializeDescription(notes, next, metaFromParsed(parsed)) });
  };

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`cursor-grab rounded-lg border border-neutral-200 p-3 shadow-sm transition-colors active:cursor-grabbing ${
        remote ? REMOTE_FLASH : "bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-600">{key}</span>
        <div className="flex items-center">
          {item.status !== "done" && (
            <button
              type="button"
              onClick={onFocus}
              aria-label={`Focus on ${key}`}
              title="Start a 25-minute focus session on this item"
              className="mr-1 rounded-md border border-neutral-200 px-1.5 py-0.5 text-xs font-medium text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              🎯 Focus
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${key} details`}
            title="Edit"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Move ${key} to trash`}
            title="Move to trash"
            className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <button type="button" onClick={onEdit} aria-label={`Edit ${key}`} className="mt-2 block w-full cursor-pointer text-left">
        <p className={`text-sm font-medium ${item.status === "done" ? "text-neutral-400 line-through" : ""}`}>
          {item.title}
        </p>
        {notes && <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{notes}</p>}
      </button>
      {(tasks.length > 0 || hasMeta(parsed)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <SubtaskPill tasks={tasks} expanded={showTasks} onToggle={() => setShowTasks((v) => !v)} />
          <ItemMeta parsed={parsed} githubUrl={githubUrl} status={item.status} blockerStatus={blockerStatus} />
        </div>
      )}
      {showTasks && tasks.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-md bg-neutral-50 p-2">
          {tasks.map((t, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleTask(i)}
                aria-label={`Mark "${t.text}" ${t.done ? "not done" : "done"}`}
                className="h-3.5 w-3.5 accent-indigo-600"
              />
              <span className={t.done ? "text-neutral-400 line-through" : "text-neutral-700"}>{t.text}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${priority.tone}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} aria-hidden />
          {priority.label}
        </span>
        {/* Keyboard / touch alternative to dragging. */}
        <PillSelect
          label={`Move ${key} to column`}
          value={item.status}
          options={statusOptions}
          onChange={(status) => onChange({ status })}
        />
        <div className="ml-auto">
          <AssigneePicker
            label={`Assignee of ${key}`}
            assigneeId={item.assignee_id}
            people={people}
            me={me}
            onChange={(assignee_id) => onChange({ assignee_id })}
          />
        </div>
      </div>
    </li>
  );
}

function KanbanBoard({
  items,
  projectId,
  me,
  people,
  githubUrl,
  statusByKey,
  remoteUpdatedIds,
  onChange,
  onEdit,
  onDelete,
  onFocus,
  onQuickAdd,
  highlight,
}: {
  items: StoredWorkItem[];
  projectId: string;
  me: Me;
  people: Person[];
  githubUrl: string;
  statusByKey: ReadonlyMap<string, WorkItemStatus>;
  remoteUpdatedIds: ReadonlySet<string>;
  onChange: (id: string, patch: Partial<StoredWorkItem>) => void;
  onEdit: (item: StoredWorkItem) => void;
  onDelete: (id: string) => void;
  onFocus: (item: StoredWorkItem) => void;
  onQuickAdd: (status: WorkItemStatus) => void;
  highlight: WorkItemStatus | null;
}) {
  const [dragOver, setDragOver] = useState<WorkItemStatus | null>(null);
  const highlightRef = useRef<HTMLElement>(null);

  // A deep link (?status=done) brings that column into view.
  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [highlight]);

  const handleDragOver = (e: DragEvent<HTMLElement>, status: WorkItemStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== status) setDragOver(status);
  };

  const handleDrop = (e: DragEvent<HTMLElement>, status: WorkItemStatus) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    const item = items.find((i) => i.id === id);
    if (item && item.status !== status) onChange(id, { status });
  };

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4">
      {statusOptions.map((col) => {
        const cards = items.filter((i) => i.status === col.value);
        return (
          <section
            key={col.value}
            ref={col.value === highlight ? highlightRef : undefined}
            aria-label={col.label}
            onDragOver={(e) => handleDragOver(e, col.value)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(null);
            }}
            onDrop={(e) => handleDrop(e, col.value)}
            className={`flex min-w-[280px] flex-1 flex-col rounded-lg border bg-neutral-50 transition-colors ${
              dragOver === col.value
                ? "border-indigo-400 bg-indigo-50/60"
                : col.value === highlight
                  ? "border-red-400 ring-2 ring-red-200"
                  : "border-neutral-200"
            }`}
          >
            <header className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium">
              <span className={`h-2 w-2 rounded-full ${columnDot[col.value]}`} aria-hidden />
              {col.label}
              <span className="rounded-full bg-white px-1.5 text-xs font-normal text-neutral-500 ring-1 ring-neutral-200">
                {cards.length}
              </span>
            </header>
            <ul className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {cards.map((item) => (
                <BoardCard
                  key={item.id}
                  item={item}
                  projectId={projectId}
                  me={me}
                  people={people}
                  githubUrl={githubUrl}
                  statusByKey={statusByKey}
                  remote={remoteUpdatedIds.has(item.id)}
                  onChange={(patch) => onChange(item.id, patch)}
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item.id)}
                  onFocus={() => onFocus(item)}
                />
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onQuickAdd(col.value)}
              className="m-2 mt-0 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800"
            >
              <Plus className="h-4 w-4" aria-hidden /> Add to {col.label}
            </button>
          </section>
        );
      })}
    </div>
  );
}

const fieldClass =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

// Shared by the "New work item" and "Edit Work Item" dialogs; `initial` pre-fills it for editing.
function ItemForm({
  projectKey,
  heading,
  submitLabel,
  initial,
  defaultStatus,
  defaultTitle,
  people,
  me,
  cycleNames,
  moduleNames,
  blockers,
  author,
  onSubmit,
  onCancel,
}: {
  projectKey: string;
  heading: string;
  submitLabel: string;
  initial?: StoredWorkItem;
  defaultStatus?: WorkItemStatus;
  defaultTitle?: string;
  people: Person[];
  me: Me;
  cycleNames: string[];
  moduleNames: string[];
  blockers: { id: string; key: string; title: string }[];
  author: string; // who comments are written as
  onSubmit: (input: NewWorkItemInput) => void;
  onCancel: () => void;
}) {
  const initialParts = parseDescription(initial?.description ?? null);
  const [tasks, setTasks] = useState<SubTask[]>(initialParts.tasks);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<TicketComment[]>(initialParts.comments);
  const [commentDraft, setCommentDraft] = useState("");

  const newComment = (text: string): TicketComment => ({
    id: crypto.randomUUID(),
    author,
    date: new Date().toISOString().slice(0, 16),
    text,
  });

  const addComment = () => {
    const text = commentDraft.trim();
    if (!text) return;
    setComments((prev) => [...prev, newComment(text)]);
    setCommentDraft("");
  };

  const addTask = () => {
    const text = draft.trim();
    if (!text) return;
    setTasks((prev) => [...prev, { text, done: false }]);
    setDraft("");
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim();
    if (!title) return;
    // A sub-task typed but not yet added still counts.
    const pending = draft.trim();
    const allTasks = pending ? [...tasks, { text: pending, done: false }] : tasks;
    onSubmit({
      title,
      description:
        serializeDescription(String(f.get("description") ?? ""), allTasks, {
          label: WORK_ITEM_LABELS.find((l) => l === f.get("label")) ?? null,
          dueDate: String(f.get("due") ?? "") || null,
          cycle: String(f.get("cycle") ?? "") || null,
          module: String(f.get("module") ?? "") || null,
          commit: String(f.get("commit") ?? "").trim() || null,
          pr: String(f.get("pr") ?? "").trim() || null,
          // Kept as is here; the status change itself stamps or clears it when the item is saved.
          completedDate: initialParts.completedDate,
          blockedBy: String(f.get("blocked") ?? "") || null,
          // A comment typed but not yet added still counts.
          comments: commentDraft.trim() ? [...comments, newComment(commentDraft.trim())] : comments,
        }) ?? "",
      status: f.get("status") as WorkItemStatus,
      priority: f.get("priority") as WorkItemPriority,
      assignee_id: String(f.get("assignee") ?? "") || null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-600">{projectKey}</span>
        <h2 className="text-base font-semibold">{heading}</h2>
      </div>
      <div>
        <label htmlFor="wi-title" className="mb-1 block text-xs font-medium text-neutral-600">
          Title
        </label>
        <input
          id="wi-title"
          name="title"
          required
          autoFocus
          maxLength={200}
          defaultValue={initial?.title ?? defaultTitle}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="wi-description" className="mb-1 block text-xs font-medium text-neutral-600">
          Description <span className="font-normal text-neutral-400">(optional)</span>
        </label>
        <textarea
          id="wi-description"
          name="description"
          rows={3}
          defaultValue={initialParts.notes}
          className={`${fieldClass} resize-none`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="wi-label" className="mb-1 block text-xs font-medium text-neutral-600">
            Label
          </label>
          <select id="wi-label" name="label" defaultValue={initialParts.label ?? ""} className={fieldClass}>
            <option value="">None</option>
            {WORK_ITEM_LABELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wi-due" className="mb-1 block text-xs font-medium text-neutral-600">
            Due date
          </label>
          <input id="wi-due" name="due" type="date" defaultValue={initialParts.dueDate ?? ""} className={fieldClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="wi-cycle" className="mb-1 block text-xs font-medium text-neutral-600">
            Cycle
          </label>
          <select id="wi-cycle" name="cycle" defaultValue={initialParts.cycle ?? ""} className={fieldClass}>
            <option value="">None</option>
            {withCurrent(cycleNames, initialParts.cycle).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wi-module" className="mb-1 block text-xs font-medium text-neutral-600">
            Module
          </label>
          <select id="wi-module" name="module" defaultValue={initialParts.module ?? ""} className={fieldClass}>
            <option value="">None</option>
            {withCurrent(moduleNames, initialParts.module).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="wi-commit" className="mb-1 block text-xs font-medium text-neutral-600">
            Linked Commit SHA <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            id="wi-commit"
            name="commit"
            defaultValue={initialParts.commit ?? ""}
            pattern="[a-fA-F0-9]{7,40}"
            title="7 to 40 hexadecimal characters"
            maxLength={40}
            placeholder="1053a36"
            className={`${fieldClass} font-mono`}
          />
        </div>
        <div>
          <label htmlFor="wi-pr" className="mb-1 block text-xs font-medium text-neutral-600">
            Linked Pull Request # <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            id="wi-pr"
            name="pr"
            defaultValue={initialParts.pr ?? ""}
            pattern="#?[0-9]+"
            title="A pull request number, like 42"
            inputMode="numeric"
            maxLength={8}
            placeholder="42"
            className={`${fieldClass} font-mono`}
          />
        </div>
      </div>
      <div>
        <label htmlFor="wi-blocked" className="mb-1 block text-xs font-medium text-neutral-600">
          Blocked By
        </label>
        <select id="wi-blocked" name="blocked" defaultValue={initialParts.blockedBy ?? ""} className={fieldClass}>
          <option value="">None</option>
          {blockers
            .filter((b) => b.id !== initial?.id)
            .map((b) => (
              <option key={b.id} value={b.key}>
                {b.key} — {b.title}
              </option>
            ))}
          {/* A blocker that is no longer on the board stays selectable so saving does not drop it. */}
          {initialParts.blockedBy && !blockers.some((b) => b.key === initialParts.blockedBy) && (
            <option value={initialParts.blockedBy}>{initialParts.blockedBy} (not on this board)</option>
          )}
        </select>
      </div>
      <fieldset>
        <legend className="mb-1 block text-xs font-medium text-neutral-600">
          Sub-tasks / Checklist{tasks.length > 0 && ` (${taskProgress(tasks).done}/${tasks.length})`}
        </legend>
        {tasks.length > 0 && (
          <ul className="mb-2 space-y-1">
            {tasks.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={t.done}
                  aria-label={`Mark "${t.text}" ${t.done ? "not done" : "done"}`}
                  onChange={() => setTasks((prev) => prev.map((p, j) => (j === i ? { ...p, done: !p.done } : p)))}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className={`min-w-0 flex-1 truncate ${t.done ? "text-neutral-400 line-through" : ""}`}>{t.text}</span>
                <button
                  type="button"
                  onClick={() => setTasks((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove "${t.text}"`}
                  className="rounded p-0.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // Enter adds the sub-task instead of submitting the form
                addTask();
              }
            }}
            aria-label="New sub-task"
            placeholder="Add a sub-task…"
            maxLength={200}
            className={fieldClass}
          />
          <button
            type="button"
            onClick={addTask}
            className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Add
          </button>
        </div>
      </fieldset>
      {initial && (
        <fieldset>
          <legend className="mb-1 block text-xs font-medium text-neutral-600">
            Comments &amp; Progress Log{comments.length > 0 && ` (${comments.length})`}
          </legend>
          {comments.length > 0 && (
            <ul className="mb-2 space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-md bg-neutral-50 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-neutral-700">{c.author}</span> · {formatCommentDate(c.date)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setComments((prev) => prev.filter((p) => p.id !== c.id))}
                      aria-label={`Delete comment by ${c.author}`}
                      className="rounded p-0.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-neutral-800">{c.text}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault(); // Enter adds the comment instead of submitting the form
                  addComment();
                }
              }}
              aria-label="New comment"
              placeholder="Write a progress note…"
              maxLength={500}
              className={fieldClass}
            />
            <button
              type="button"
              onClick={addComment}
              className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              Add Comment
            </button>
          </div>
        </fieldset>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="wi-status" className="mb-1 block text-xs font-medium text-neutral-600">
            Status
          </label>
          <select id="wi-status" name="status" defaultValue={initial?.status ?? defaultStatus ?? "backlog"} className={fieldClass}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wi-priority" className="mb-1 block text-xs font-medium text-neutral-600">
            Priority
          </label>
          <select id="wi-priority" name="priority" defaultValue={initial?.priority ?? "medium"} className={fieldClass}>
            {priorityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="wi-assignee" className="mb-1 block text-xs font-medium text-neutral-600">
          Assignee
        </label>
        <select id="wi-assignee" name="assignee" defaultValue={initial?.assignee_id ?? ""} className={fieldClass}>
          {assigneeOptions(people, me, initial?.assignee_id ?? null).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function WorkItems({ projectId, workspaceId }: { projectId: string; workspaceId: string | null }) {
  const { user } = useAuth();
  const { displayName, profile } = useProfile();
  // Presence payload: only the small cloud thumbnail of the avatar is shared, never the full local image.
  const metaAvatar = (user?.user_metadata as Record<string, unknown> | undefined)?.avatar_url;
  const viewer: Viewer | null = user
    ? { id: user.id, name: displayName, avatar_url: typeof metaAvatar === "string" ? metaAvatar : null, role: profile.role }
    : null;
  const {
    items: allItems,
    error,
    add,
    update,
    softDelete,
    realtimeStatus,
    activeUsers,
    remoteUpdatedIds,
  } = useWorkItems(projectId, workspaceId, viewer);
  const items = allItems ?? [];
  const teammates = activeUsers.filter((v) => v.id !== user?.id);
  const statusParam = parseStatus(useSearchParams().get("status"));
  const [filter, setFilter] = useState<Filter>(statusParam ?? "all");
  // Following a deep link while this view is already mounted: adopt the new status during render.
  const [seenParam, setSeenParam] = useState(statusParam);
  if (statusParam !== seenParam) {
    setSeenParam(statusParam);
    if (statusParam) setFilter(statusParam);
  }
  const { open, openDialog, closeDialog, presetTitle } = useNewWorkItem();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [editingItem, setEditingItem] = useState<StoredWorkItem | null>(null);
  // The board's per-column "Add" buttons pre-select that column's status in the new-item dialog.
  const [presetStatus, setPresetStatus] = useState<WorkItemStatus>("backlog");
  // The component only renders on the client (see WorkItemsView), so reading localStorage here is safe.
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list";
    } catch {
      return "list";
    }
  });
  const chooseView = useCallback((next: ViewMode) => {
    setViewMode(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // storage blocked: the choice just won't persist
    }
  }, []);
  const [query, setQuery] = useState("");
  const [transferring, setTransferring] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Board shortcuts: "/" search, "b" board, "l" list. Ignored while typing, with modifiers, or with a dialog open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector("dialog[open]")) return;
      const key = e.key.toLowerCase();
      if (key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (key === "b") chooseView("board");
      else if (key === "l") chooseView("list");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chooseView]);
  // In the cloud, assignees are real auth users; local preview keeps the mock user.
  const me: Me = workspaceId && user ? { id: user.id, name: displayName } : mockUser;
  // Everyone who can be assigned: the workspace's members in the cloud, just the mock user in local preview.
  const members = useWorkspaceMembers(workspaceId);
  const people: Person[] = (members ?? [])
    .map((m) => ({
      id: m.user_id,
      name: m.user_id === me.id ? me.name : nameFromEmail(m.email ?? "Member"),
      avatar_url: m.user_id === me.id ? profile.avatar_url : null,
    }))
    .concat(workspaceId ? [] : [{ id: mockUser.id, name: mockUser.name, avatar_url: profile.avatar_url }]);

  // Cycle and module choices for the dialogs. WorkItems only renders on the client, so reading localStorage is safe.
  const cycleNames = useMemo(() => getCycles(projectId).map((c) => c.name), [projectId]);
  const moduleNames = useMemo(() => getModules(projectId).map((m) => m.name), [projectId]);

  // Native <dialog> gives focus trapping, Esc-to-close and an inert page behind it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) return;
    if (editingItem && !dialog.open) dialog.showModal();
    if (!editingItem && dialog.open) dialog.close();
  }, [editingItem]);

  // Starts a 25-minute focus session on the item, and moves it out of the backlog if it was still there.
  const focusOn = (item: StoredWorkItem) => {
    if (item.status === "backlog") update(item.id, { status: "in_progress" });
    startFocusTimer(workItemKey(projectId, item.seq), item.title);
  };

  // Every ticket on the board by key, for "blocked by" badges and the Blocked By choices.
  const boardTickets = items.filter((i) => !i.deleted_at).map((i) => ({ id: i.id, key: workItemKey(projectId, i.seq), title: i.title, status: i.status }));
  const statusByKey = new Map(boardTickets.map((t) => [t.key, t.status] as const));

  const needle = query.trim().toLowerCase();
  const live = items
    .filter((i) => !i.deleted_at)
    .filter(
      (i) =>
        !needle ||
        workItemKey(projectId, i.seq).toLowerCase().includes(needle) ||
        i.title.toLowerCase().includes(needle) ||
        parseDescription(i.description).notes.toLowerCase().includes(needle)
    )
    .sort((a, b) => a.seq - b.seq);
  const visible = filter === "all" ? live : live.filter((i) => i.status === filter);
  const count = (f: Filter) => (f === "all" ? live.length : live.filter((i) => i.status === f).length);
  const projectRecord = getProjects().find((p) => p.id === projectId);
  const projectName = projectRecord?.name ?? projectId;
  const githubUrl = projectRecord?.github_url ?? "";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-2 text-sm">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-neutral-500">
          <Link href="/projects" className="hover:text-neutral-900">Projects</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{projectName}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-neutral-900">Work items</span>
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          <PresenceAvatars viewers={teammates} />
          <LiveStatusBadge cloud={workspaceId !== null} status={realtimeStatus} />
          <div role="group" aria-label="View" className="flex rounded-md bg-neutral-100 p-0.5">
            {viewOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={viewMode === value}
                onClick={() => chooseView(value)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 ${
                  viewMode === value ? "bg-white font-medium shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTransferring(true)}
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-neutral-700 hover:bg-neutral-100"
          >
            <ArrowUpDown className="h-4 w-4" aria-hidden /> Import / Export
          </button>
          <button
            type="button"
            onClick={openDialog}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> New work item
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 px-4 py-2">
        {viewMode === "list" && (
          <div role="tablist" aria-label="Filter by status" className="flex gap-1">
            {filters.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setFilter(f.value)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm ${
                    active ? "bg-neutral-200 font-medium text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {f.label}
                  <span className="rounded-full bg-white px-1.5 text-xs text-neutral-500 ring-1 ring-neutral-200">
                    {count(f.value)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            aria-label="Search work items"
            placeholder="Search work items…"
            className="w-48 rounded-md border border-neutral-300 bg-white py-1 pl-7 pr-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <p className="ml-auto hidden text-xs text-neutral-500 md:block">
          Shortcuts: <kbd className="font-mono">C</kbd> new · <kbd className="font-mono">/</kbd> search ·{" "}
          <kbd className="font-mono">B</kbd> board · <kbd className="font-mono">L</kbd> list
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {allItems === null ? (
          <p className="px-6 py-16 text-center text-sm text-neutral-500">Loading work items…</p>
        ) : viewMode === "board" ? (
          <KanbanBoard
            highlight={statusParam}
            items={live}
            projectId={projectId}
            me={me}
            people={people}
            githubUrl={githubUrl}
            statusByKey={statusByKey}
            remoteUpdatedIds={remoteUpdatedIds}
            onChange={update}
            onEdit={setEditingItem}
            onDelete={softDelete}
            onFocus={focusOn}
            onQuickAdd={(status) => {
              setPresetStatus(status);
              openDialog();
            }}
          />
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <ListChecks className="h-8 w-8 text-neutral-400" />
            <p className="mt-3 text-sm font-medium">{filter === "all" && !needle ? "No work items yet" : "Nothing here"}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {needle
                ? "No work items match your search."
                : filter === "all"
                  ? "Press C or use New work item to add one."
                  : "No work items match this filter."}
            </p>
          </div>
        ) : (
          <ul>
            {visible.map((item) => (
              <WorkItemRow
                key={item.id}
                item={item}
                projectId={projectId}
                me={me}
                people={people}
                githubUrl={githubUrl}
                statusByKey={statusByKey}
                remote={remoteUpdatedIds.has(item.id)}
                onChange={(patch) => update(item.id, patch)}
                onEdit={() => setEditingItem(item)}
                onDelete={() => softDelete(item.id)}
                onFocus={() => focusOn(item)}
              />
            ))}
          </ul>
        )}
      </div>

      <ImportExportDialog
        open={transferring}
        onClose={() => setTransferring(false)}
        projectId={projectId}
        items={items}
        onImport={(inputs) => {
          inputs.forEach(add);
          setFilter("all");
        }}
      />

      <dialog
        ref={dialogRef}
        onClose={() => {
          closeDialog();
          setPresetStatus("backlog");
        }}
        onClick={(e) => e.target === e.currentTarget && closeDialog()}
        aria-label="New work item"
        className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
      >
        {open && (
          <ItemForm
            projectKey={projectIdentifier(projectId)}
            heading="New work item"
            submitLabel="Create work item"
            defaultStatus={presetStatus}
            defaultTitle={presetTitle}
            people={people}
            me={me}
            cycleNames={cycleNames}
            moduleNames={moduleNames}
            blockers={boardTickets}
            author={displayName}
            onCancel={closeDialog}
            onSubmit={(input) => {
              add(input);
              setFilter("all");
              closeDialog();
            }}
          />
        )}
      </dialog>

      <dialog
        ref={editDialogRef}
        onClose={() => setEditingItem(null)}
        onClick={(e) => e.target === e.currentTarget && setEditingItem(null)}
        aria-label="Edit Work Item"
        className="m-auto w-full max-w-md rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
      >
        {editingItem && (
          <ItemForm
            key={editingItem.id}
            projectKey={workItemKey(projectId, editingItem.seq)}
            heading="Edit Work Item"
            submitLabel="Save changes"
            initial={editingItem}
            people={people}
            me={me}
            cycleNames={cycleNames}
            moduleNames={moduleNames}
            blockers={boardTickets}
            author={displayName}
            onCancel={() => setEditingItem(null)}
            onSubmit={(input) => {
              update(editingItem.id, {
                title: input.title.trim(),
                description: input.description.trim() || null,
                status: input.status,
                priority: input.priority,
                assignee_id: input.assignee_id ?? null,
              });
              setEditingItem(null);
            }}
          />
        )}
      </dialog>
    </div>
  );
}

export default function WorkItemsView({ projectId }: { projectId: string }) {
  const mounted = useIsClient();
  const target = useStorageTarget();
  if (!mounted || target.mode === "loading") return <div className="h-full" />;
  const workspaceId = target.mode === "cloud" ? target.workspaceId : null;
  // Remount when the data source changes (sign-in, sign-out, workspace switch).
  return <WorkItems key={workspaceId ?? "local"} projectId={projectId} workspaceId={workspaceId} />;
}
