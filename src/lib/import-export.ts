import {
  COMMIT_PATTERN,
  parseDescription,
  PR_PATTERN,
  serializeDescription,
  taskProgress,
  WORK_ITEM_LABELS,
  type SubTask,
  type WorkItemLabel,
} from "./checklist";
import { downloadFile } from "./project-report";
import {
  workItemKey,
  type NewWorkItemInput,
  type StoredWorkItem,
  type WorkItemPriority,
  type WorkItemStatus,
} from "./work-items-storage";

const MAX_IMPORT_ROWS = 1000;
const CSV_HEADERS = [
  "Key",
  "Title",
  "Status",
  "Priority",
  "Label",
  "Due Date",
  "Cycle",
  "Module",
  "Subtasks Done",
  "Subtasks Total",
  "Notes",
  "Commit",
  "PR",
] as const;

// ---------------------------------------------------------------- export

// RFC 4180: a field with a comma, quote or line break is wrapped in quotes, and quotes inside it are doubled.
const csvField = (value: string | number) => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const liveItems = (items: StoredWorkItem[]) => items.filter((i) => !i.deleted_at).sort((a, b) => a.seq - b.seq);

export function exportWorkItemsToCsv(items: StoredWorkItem[], filename: string, projectId: string): void {
  const rows = liveItems(items).map((item) => {
    const p = parseDescription(item.description);
    const { done, total } = taskProgress(p.tasks);
    return [
      workItemKey(projectId, item.seq),
      item.title,
      item.status,
      item.priority,
      p.label ?? "",
      p.dueDate ?? "",
      p.cycle ?? "",
      p.module ?? "",
      done,
      total,
      p.notes,
      p.commit ?? "",
      p.pr ?? "",
    ];
  });
  const csv = [CSV_HEADERS as readonly string[], ...rows].map((row) => row.map(csvField).join(",")).join("\r\n");
  // The byte-order mark makes Excel read the file as UTF-8.
  downloadFile(filename, `﻿${csv}\r\n`, "text/csv;charset=utf-8");
}

export function exportWorkItemsToJson(items: StoredWorkItem[], filename: string, projectId: string): void {
  const data = liveItems(items).map((item) => {
    const p = parseDescription(item.description);
    return {
      key: workItemKey(projectId, item.seq),
      title: item.title,
      status: item.status,
      priority: item.priority,
      label: p.label,
      dueDate: p.dueDate,
      cycle: p.cycle,
      module: p.module,
      subtasks: p.tasks,
      notes: p.notes,
      commit: p.commit,
      pr: p.pr,
    };
  });
  downloadFile(filename, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
}

// ---------------------------------------------------------------- import

const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

function toStatus(value: string): WorkItemStatus {
  const v = norm(value);
  if (["done", "complete", "completed", "closed", "resolved", "finished"].includes(v)) return "done";
  if (["inprogress", "doing", "started", "wip", "active", "ongoing"].includes(v)) return "in_progress";
  return "backlog";
}

function toPriority(value: string): WorkItemPriority {
  const v = norm(value);
  if (["high", "urgent", "critical", "p0", "p1", "highest", "blocker"].includes(v)) return "high";
  if (["low", "minor", "lowest", "trivial", "p3", "p4"].includes(v)) return "low";
  return "medium";
}

const toLabel = (value: string): WorkItemLabel | null => WORK_ITEM_LABELS.find((l) => norm(l) === norm(value)) ?? null;
const toDate = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null);
const toCommit = (value: string) => (COMMIT_PATTERN.test(value.trim()) ? value.trim() : null);
const toPr = (value: string) => (PR_PATTERN.test(value.trim()) ? value.trim().replace("#", "") : null);

type Fields = {
  title: string;
  status: string;
  priority: string;
  notes: string;
  label: string;
  due: string;
  cycle: string;
  module: string;
  commit: string;
  pr: string;
  tasks: SubTask[];
};

function build(f: Fields): NewWorkItemInput | null {
  const title = f.title.trim();
  if (!title) return null;
  return {
    title: title.slice(0, 200),
    description:
      serializeDescription(f.notes, f.tasks, {
        label: toLabel(f.label),
        dueDate: toDate(f.due),
        cycle: f.cycle.trim() || null,
        module: f.module.trim() || null,
        commit: toCommit(f.commit),
        pr: toPr(f.pr),
      }) ?? "",
    status: toStatus(f.status),
    priority: toPriority(f.priority),
  };
}

// Header names are matched loosely ("Task", "Summary" and "Name" all mean the title).
const COLUMN_ALIASES: Record<Exclude<keyof Fields, "tasks">, string[]> = {
  title: ["title", "name", "summary", "task", "issue", "subject"],
  status: ["status", "state", "column"],
  priority: ["priority", "severity"],
  notes: ["notes", "description", "details", "body", "note"],
  label: ["label", "type", "category", "kind"],
  due: ["duedate", "due", "deadline", "targetdate"],
  cycle: ["cycle", "sprint", "iteration"],
  module: ["module", "epic", "component"],
  commit: ["commit", "commitsha", "sha"],
  pr: ["pr", "pullrequest", "prnumber"],
};

// RFC 4180 reader: quoted fields may hold commas, doubled quotes and line breaks.
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function parseWorkItemsCsv(csvText: string): NewWorkItemInput[] {
  const [header, ...rows] = readCsv(csvText);
  if (!header) return [];
  const headers = header.map(norm);
  const column = (name: keyof typeof COLUMN_ALIASES) => headers.findIndex((h) => COLUMN_ALIASES[name].includes(h));
  const index = {
    title: column("title"),
    status: column("status"),
    priority: column("priority"),
    notes: column("notes"),
    label: column("label"),
    due: column("due"),
    cycle: column("cycle"),
    module: column("module"),
    commit: column("commit"),
    pr: column("pr"),
  };
  if (index.title < 0) throw new Error("The CSV needs a Title column.");

  const out: NewWorkItemInput[] = [];
  for (const r of rows.slice(0, MAX_IMPORT_ROWS)) {
    const get = (i: number) => (i >= 0 ? (r[i] ?? "") : "");
    const item = build({
      title: get(index.title),
      status: get(index.status),
      priority: get(index.priority),
      notes: get(index.notes),
      label: get(index.label),
      due: get(index.due),
      cycle: get(index.cycle),
      module: get(index.module),
      commit: get(index.commit),
      pr: get(index.pr),
      tasks: [],
    });
    if (item) out.push(item);
  }
  return out;
}

const str = (value: unknown) => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

export function parseWorkItemsJson(jsonText: string): NewWorkItemInput[] {
  let data: unknown;
  try {
    data = JSON.parse(jsonText.replace(/^﻿/, ""));
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const list = Array.isArray(data) ? data : (data as { workItems?: unknown } | null)?.workItems;
  if (!Array.isArray(list)) throw new Error("Expected a JSON array of work items.");

  const out: NewWorkItemInput[] = [];
  for (const entry of list.slice(0, MAX_IMPORT_ROWS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const pick = (names: string[]) => {
      const key = Object.keys(e).find((k) => names.includes(norm(k)));
      return key ? e[key] : undefined;
    };
    const rawTasks = pick(["subtasks", "tasks", "checklist"]);
    const tasks: SubTask[] = Array.isArray(rawTasks)
      ? rawTasks.flatMap((t): SubTask[] => {
          if (typeof t === "string") return t.trim() ? [{ text: t.trim(), done: false }] : [];
          if (typeof t === "object" && t !== null) {
            const o = t as { text?: unknown; done?: unknown };
            return typeof o.text === "string" && o.text.trim() ? [{ text: o.text.trim(), done: o.done === true }] : [];
          }
          return [];
        })
      : [];
    const item = build({
      title: str(pick(COLUMN_ALIASES.title)),
      status: str(pick(COLUMN_ALIASES.status)),
      priority: str(pick(COLUMN_ALIASES.priority)),
      notes: str(pick(COLUMN_ALIASES.notes)),
      label: str(pick(COLUMN_ALIASES.label)),
      due: str(pick(COLUMN_ALIASES.due)),
      cycle: str(pick(COLUMN_ALIASES.cycle)),
      module: str(pick(COLUMN_ALIASES.module)),
      commit: str(pick(COLUMN_ALIASES.commit)),
      pr: str(pick(COLUMN_ALIASES.pr)),
      tasks,
    });
    if (item) out.push(item);
  }
  return out;
}
