import path from "node:path";

// The developer's fleet: project id -> folders it may live in on this machine, most likely first.
// Only these ids are ever resolved, so ?project= can never point the server at an arbitrary directory.
export const FLEET_PATHS: Record<string, string[]> = {
  "collab-workspace": [process.cwd()],
  "exam-reviewer-app": [
    "C:/Users/MarvinJhayAdorable/Projects/exam-reviewer-app",
    path.resolve(process.cwd(), "..", "Projects", "exam-reviewer-app"),
    path.resolve(process.cwd(), "..", "exam-reviewer-app"),
  ],
  "mastersoft-grade-encoding-assistant": [
    "C:/Users/MarvinJhayAdorable/Mastersoft-Grade-Encoding-Assistant-repo",
    path.resolve(process.cwd(), "..", "Mastersoft-Grade-Encoding-Assistant-repo"),
    "C:/Users/MarvinJhayAdorable/Projects/Mastersoft-Grade-Encoding-Assistant-main",
  ],
};

// Reading the working tree only makes sense on the machine it lives on. A Vercel deployment answers
// { isLocal: false } and the UI shows a cloud badge instead.
export function isLocalhost(host: string | null): boolean {
  if (!host) return false;
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return name === "localhost" || name === "127.0.0.1" || name === "::1" || name.endsWith(".localhost");
}
