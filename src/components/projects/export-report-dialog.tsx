"use client";

import { useEffect, useMemo, useRef } from "react";
import { FileJson, FileText, Printer, X } from "lucide-react";
import LiveWorkItems from "@/components/home/live-work-items";
import { healthLabel, useHealth } from "@/components/home/use-health";
import {
  buildReport,
  downloadFile,
  jsonFromReport,
  markdownFromReport,
  reportDate,
  type ProjectReport,
} from "@/lib/project-report";
import type { ProjectRecord } from "@/lib/projects";
import type { StoredWorkItem } from "@/lib/work-items-storage";

// The report as a formatted document: this is both the on-screen preview and what gets printed.
function ReportDocument({ report }: { report: ProjectReport }) {
  const { project, progress } = report;
  const h2 = "mt-6 border-b border-neutral-200 pb-1 text-sm font-semibold text-neutral-900";
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-800">
      <h1 className="text-xl font-semibold">{project.name} — Project Report</h1>
      <p className="mt-1 text-xs text-neutral-500">
        {project.identifier} · Generated {reportDate(report)} · {report.health ?? "No live URL set"}
      </p>

      <h2 className={h2}>What it is</h2>
      <p className="mt-2 leading-relaxed">{project.description || "No description yet."}</p>
      {project.functions.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {project.functions.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}

      <h2 className={h2}>Tech stack</h2>
      <table className="mt-2 w-full text-left text-xs">
        <thead className="border-b border-neutral-300 text-neutral-500">
          <tr>
            <th className="py-1 pr-3 font-medium">Layer</th>
            <th className="py-1 pr-3 font-medium">Technologies Used</th>
            <th className="py-1 font-medium">Responsibilities</th>
          </tr>
        </thead>
        <tbody>
          {report.techStack.map((t) => (
            <tr key={t.layer} className="border-b border-neutral-100 align-top">
              <th scope="row" className="py-1.5 pr-3 font-medium">{t.layer}</th>
              <td className="py-1.5 pr-3">{t.tech}</td>
              <td className="py-1.5 text-neutral-500">{t.role}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className={h2}>Sprint & work items progress</h2>
      <p className="mt-2">
        <strong>{progress.percent}% complete</strong> — {progress.done} done, {progress.active} active ({progress.inProgress}{" "}
        in progress, {progress.backlog} backlog) of {progress.total}.
      </p>
      {report.tickets.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {report.tickets.map((t) => (
            <li key={t.key} className="flex gap-2">
              <span className="w-14 shrink-0 font-mono text-neutral-500">{t.key}</span>
              <span className="min-w-0 flex-1">{t.title}</span>
              <span className="shrink-0 text-neutral-500">
                {t.statusLabel} · {t.priority}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className={h2}>Process flows</h2>
      {report.flows.map((f) => (
        <section key={f.category} className="mt-3 break-inside-avoid">
          <h3 className="text-xs font-semibold">{f.title}</h3>
          <p className="text-xs text-neutral-500">{f.summary}</p>
          <p className="mt-1 text-xs">{f.steps.map((s) => s.label).join("  →  ")}</p>
        </section>
      ))}
    </article>
  );
}

function ReportBody({ project, items, onClose }: { project: ProjectRecord; items: StoredWorkItem[] | null; onClose: () => void }) {
  const { health } = useHealth(project.live_url);
  const healthStatus = health.state === "none" ? null : healthLabel(health);
  const report = useMemo(
    () => (items ? buildReport(project, items, healthStatus) : null),
    [project, items, healthStatus]
  );
  const ready = report !== null && health.state !== "checking";

  const actions: { label: string; hint: string; icon: typeof FileText; run: () => void }[] = [
    {
      label: "Download Markdown",
      hint: ".md",
      icon: FileText,
      run: () => report && downloadFile(`${project.id}-report.md`, markdownFromReport(report), "text/markdown;charset=utf-8"),
    },
    { label: "Print / Save as PDF", hint: "print dialog", icon: Printer, run: () => window.print() },
    {
      label: "Download JSON",
      hint: ".json",
      icon: FileJson,
      run: () =>
        report &&
        downloadFile(`${project.id}-telemetry.json`, JSON.stringify(jsonFromReport(report), null, 2), "application/json;charset=utf-8"),
    },
  ];

  return (
    <div className="flex max-h-[85vh] flex-col">
      <header className="no-print flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
        <h2 className="text-base font-semibold">Export report</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-neutral-500 hover:bg-neutral-100">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="no-print grid gap-2 border-b border-neutral-200 p-4 sm:grid-cols-3">
        {actions.map(({ label, hint, icon: Icon, run }) => (
          <button
            key={label}
            type="button"
            disabled={!ready}
            onClick={run}
            className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-left text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
            <span className="min-w-0">
              {label}
              <span className="block text-xs font-normal text-neutral-500">{hint}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="print-area min-h-0 flex-1 overflow-y-auto bg-neutral-50 p-4">
        {report ? <ReportDocument report={report} /> : <p className="py-12 text-center text-sm text-neutral-500">Preparing report…</p>}
      </div>
    </div>
  );
}

export default function ExportReportDialog({ project, open, onClose }: { project: ProjectRecord; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  // Native <dialog> gives focus trapping, Esc-to-close and an inert page behind it.
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
      aria-label="Export report"
      className="report-dialog m-auto w-full max-w-3xl rounded-xl border border-neutral-200 p-0 shadow-xl backdrop:bg-black/30"
    >
      {open && (
        <LiveWorkItems projectId={project.id} fallback={<p className="p-8 text-center text-sm text-neutral-500">Preparing report…</p>}>
          {(items) => <ReportBody project={project} items={items} onClose={onClose} />}
        </LiveWorkItems>
      )}
    </dialog>
  );
}
