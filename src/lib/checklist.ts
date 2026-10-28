// Sub-tasks, a type label and a due date live inside a work item's description as plain lines
// ("- [ ] task", "- [x] task", "[label: Bug]", "[due: 2026-11-05]"), so they need no schema change and still
// read fine anywhere the raw description is shown.
export type SubTask = { text: string; done: boolean };

export const WORK_ITEM_LABELS = ["Feature", "Bug", "Architecture", "DevOps", "UX"] as const;
export type WorkItemLabel = (typeof WORK_ITEM_LABELS)[number];

// A progress note on a ticket. The id is its position in the description, so it is only stable until one is deleted.
export type TicketComment = { id: string; date: string; author: string; text: string };

export type DescriptionMeta = {
  blockedBy?: string | null; // ticket key such as "CW-3"
  comments?: TicketComment[];
  label?: WorkItemLabel | null;
  dueDate?: string | null;
  cycle?: string | null;
  module?: string | null;
  completedDate?: string | null; // YYYY-MM-DD, stamped when the item moves to done
  commit?: string | null; // hex SHA, 7 to 40 characters
  pr?: string | null; // pull request number, digits only
};

const TASK_LINE = /^\s*[-*]\s+\[( |x|X)\]\s+(.*\S)\s*$/;
const LABEL_LINE = /^\[label:\s*(Feature|Bug|Architecture|DevOps|UX)\]$/;
const DUE_LINE = /^\[due:\s*(\d{4}-\d{2}-\d{2})\]$/;
const CYCLE_LINE = /^\[cycle:\s*(.+)\]$/;
const MODULE_LINE = /^\[module:\s*(.+)\]$/;
const BLOCKED_LINE = /^\[blocked-by:\s*([A-Za-z0-9]+-\d+)\]$/i;
const COMMENT_LINE = /^\[comment:\s*([^|]+)\|\s*([^|]+)\|\s*(.+)\]$/;
const TICKET_KEY = /^[A-Za-z0-9]+-\d+$/;
const COMPLETED_LINE = /^\[completed:\s*(\d{4}-\d{2}-\d{2})\]$/;
const COMMIT_LINE = /^\[commit:\s*([a-f0-9]{7,40})\]$/i;
const PR_LINE = /^\[pr:\s*#?(\d+)\]$/i;

export const COMMIT_PATTERN = /^[a-f0-9]{7,40}$/i;
export const PR_PATTERN = /^#?\d+$/;

// Names go inside [brackets], so brackets and line breaks are not allowed in them.
export const cleanMetaName = (name: string) => name.replace(/[[\]\r\n]+/g, " ").replace(/\s+/g, " ").trim();

const isLabel = (value: string): value is WorkItemLabel => (WORK_ITEM_LABELS as readonly string[]).includes(value);

export function labelTone(label: WorkItemLabel): string {
  switch (label) {
    case "Feature":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Bug":
      return "border-red-200 bg-red-50 text-red-700";
    case "Architecture":
      return "border-purple-200 bg-purple-50 text-purple-700";
    case "DevOps":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "UX":
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

// Splits a description into its freeform notes, checklist items and [label] / [due] / [cycle] / [module] metadata.
export function parseDescription(description: string | null): {
  notes: string;
  tasks: SubTask[];
  label: WorkItemLabel | null;
  dueDate: string | null;
  cycle: string | null;
  module: string | null;
  commit: string | null;
  pr: string | null;
  completedDate: string | null;
  blockedBy: string | null;
  comments: TicketComment[];
} {
  const tasks: SubTask[] = [];
  const notes: string[] = [];
  let label: WorkItemLabel | null = null;
  let dueDate: string | null = null;
  let cycle: string | null = null;
  let moduleName: string | null = null;
  let commit: string | null = null;
  let pr: string | null = null;
  let completedDate: string | null = null;
  let blockedBy: string | null = null;
  const comments: TicketComment[] = [];
  for (const line of (description ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    const task = line.match(TASK_LINE);
    const labelMatch = trimmed.match(LABEL_LINE);
    const dueMatch = trimmed.match(DUE_LINE);
    const cycleMatch = trimmed.match(CYCLE_LINE);
    const moduleMatch = trimmed.match(MODULE_LINE);
    const commitMatch = trimmed.match(COMMIT_LINE);
    const prMatch = trimmed.match(PR_LINE);
    const completedMatch = trimmed.match(COMPLETED_LINE);
    const blockedMatch = trimmed.match(BLOCKED_LINE);
    const commentMatch = trimmed.match(COMMENT_LINE);
    if (task) tasks.push({ text: task[2], done: task[1] !== " " });
    else if (labelMatch && isLabel(labelMatch[1])) label = labelMatch[1];
    else if (dueMatch) dueDate = dueMatch[1];
    else if (cycleMatch) cycle = cycleMatch[1].trim();
    else if (moduleMatch) moduleName = moduleMatch[1].trim();
    else if (commitMatch) commit = commitMatch[1].toLowerCase();
    else if (prMatch) pr = prMatch[1];
    else if (completedMatch) completedDate = completedMatch[1];
    else if (blockedMatch) blockedBy = blockedMatch[1].toUpperCase();
    else if (commentMatch) {
      comments.push({ id: String(comments.length), author: commentMatch[1].trim(), date: commentMatch[2].trim(), text: commentMatch[3].trim() });
    } else notes.push(line);
  }
  return { notes: notes.join("\n").trim(), tasks, label, dueDate, cycle, module: moduleName, commit, pr, completedDate, blockedBy, comments };
}

// One comment per line: "|" separates the three fields and line breaks would split the comment, so they are removed.
const oneLine = (text: string) => text.replace(/[\r\n]+/g, " ").trim();
const commentLine = (c: TicketComment) =>
  `[comment: ${oneLine(c.author).replace(/[|[\]]/g, "") || "Unknown"} | ${oneLine(c.date).replace(/\|/g, "")} | ${oneLine(c.text)}]`;

// Every piece of metadata a parsed description carries, ready to hand back to serializeDescription unchanged.
// Use it whenever a description is edited so no tag is dropped by accident.
export function metaFromParsed(p: ReturnType<typeof parseDescription>): DescriptionMeta {
  return {
    label: p.label,
    dueDate: p.dueDate,
    cycle: p.cycle,
    module: p.module,
    commit: p.commit,
    pr: p.pr,
    completedDate: p.completedDate,
    blockedBy: p.blockedBy,
    comments: p.comments,
  };
}

// The inverse of parseDescription; null when there is nothing to store.
export function serializeDescription(notes: string, tasks: SubTask[], meta: DescriptionMeta = {}): string | null {
  const lines = tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.text}`);
  const metaLines = [
    meta.label ? `[label: ${meta.label}]` : "",
    meta.dueDate ? `[due: ${meta.dueDate}]` : "",
    meta.cycle ? `[cycle: ${cleanMetaName(meta.cycle)}]` : "",
    meta.module ? `[module: ${cleanMetaName(meta.module)}]` : "",
    meta.commit && COMMIT_PATTERN.test(meta.commit) ? `[commit: ${meta.commit.toLowerCase()}]` : "",
    meta.pr && PR_PATTERN.test(meta.pr) ? `[pr: ${meta.pr.replace("#", "")}]` : "",
    meta.completedDate && /^\d{4}-\d{2}-\d{2}$/.test(meta.completedDate) ? `[completed: ${meta.completedDate}]` : "",
    meta.blockedBy && TICKET_KEY.test(meta.blockedBy) ? `[blocked-by: ${meta.blockedBy.toUpperCase()}]` : "",
    ...(meta.comments ?? []).map(commentLine),
  ].filter(Boolean);
  const text = [notes.trim(), lines.join("\n"), metaLines.join("\n")].filter(Boolean).join("\n\n");
  return text || null;
}

// Today as YYYY-MM-DD in the user's own timezone (a UTC date would be a day off for part of the day).
export function localDateIso(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Sets (or, with null, clears) the [completed: date] stamp and keeps everything else in the description.
export function withCompletedDate(description: string | null, date: string | null): string | null {
  const p = parseDescription(description);
  return serializeDescription(p.notes, p.tasks, { ...metaFromParsed(p), completedDate: date });
}

export function taskProgress(tasks: SubTask[]): { done: number; total: number; percent: number } {
  const done = tasks.filter((t) => t.done).length;
  return { done, total: tasks.length, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

const DUE_SOON_DAYS = 3;

// Overdue (red) and due-soon (amber) only apply to unfinished items; everything else is a neutral "Due <date>".
export function dueBadge(
  dueDate: string | null,
  status: "backlog" | "in_progress" | "done"
): { text: string; tone: string } | null {
  if (!dueDate) return null;
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  const days = Math.round((due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  const date = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (status !== "done" && days < 0) return { text: `Overdue · ${date}`, tone: "border-red-200 bg-red-50 text-red-700" };
  if (status !== "done" && days <= DUE_SOON_DAYS) return { text: `Due soon · ${date}`, tone: "border-amber-200 bg-amber-50 text-amber-700" };
  return { text: `Due ${date}`, tone: "border-neutral-200 bg-neutral-50 text-neutral-600" };
}
