// Sub-tasks live inside a work item's description as markdown checklist lines ("- [ ] task" / "- [x] task"),
// so they need no schema change and still read fine anywhere the raw description is shown.
export type SubTask = { text: string; done: boolean };

const TASK_LINE = /^\s*[-*]\s+\[( |x|X)\]\s+(.*\S)\s*$/;

// Splits a description into its freeform notes and its checklist items.
export function parseDescription(description: string | null): { notes: string; tasks: SubTask[] } {
  const tasks: SubTask[] = [];
  const notes: string[] = [];
  for (const line of (description ?? "").split(/\r?\n/)) {
    const match = line.match(TASK_LINE);
    if (match) tasks.push({ text: match[2], done: match[1] !== " " });
    else notes.push(line);
  }
  return { notes: notes.join("\n").trim(), tasks };
}

// The inverse of parseDescription; null when there is nothing to store.
export function serializeDescription(notes: string, tasks: SubTask[]): string | null {
  const lines = tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.text}`);
  const text = [notes.trim(), lines.join("\n")].filter(Boolean).join("\n\n");
  return text || null;
}

export function taskProgress(tasks: SubTask[]): { done: number; total: number; percent: number } {
  const done = tasks.filter((t) => t.done).length;
  return { done, total: tasks.length, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}
