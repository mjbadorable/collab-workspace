<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# collab-workspace — Project Protocol & Memory

## Role Framework
- **Marvin (Project Owner & Lead):** Makes all decisions, reviews code, approves changes.
- **Gemini (Planner & Technical Advisor):** Breaks down problems, ensures simple architecture (no slop/overengineering), drafts modular prompts for Claude.
- **Claude (Implementer):** Writes code, runs builds, and modifies files following exact prompt instructions.

## Engineering Standards (Darla David — Cloud Chaser Ep. 15)
"Working is step one. Ready is the real job."
1. **Security:** PostgreSQL Row-Level Security (RLS) from Day 1 (`SECURITY DEFINER` helpers, no public leaks).
2. **Shipping:** Automated CI/CD via Vercel; separate staging and production.
3. **Speed:** Lazy-loaded canvas packages (`@xyflow/react`), zero hydration errors.
4. **Traffic (Concurrency):** Real-time multiplayer synchronization (Yjs / Supabase Realtime).
5. **Survival:** Soft deletion (`deleted_at`) across projects, tasks, and diagrams with 1-click Trash & Restore.

## Current State (As of 2026-10-27)
- **App Shell & Layout:** Sidebar with workspace switcher, navigation links, collapsible "Exam Reviewer App", and Home dashboard metrics.
- **Diagrams Engine (`/projects/[id]/diagrams`):** `@xyflow/react` canvas with 5 custom node types (Process, Decision, Terminal, Note, and DB Table with editable fields), toolbar, minimap, controls, and debounced localStorage autosave.
- **Work Items Tracker (`/projects/[id]/work-items`):** Linear-style task board with status tabs and counts (All, Backlog, In Progress, Done), global `C` shortcut, native `<dialog>` task modal, and sequential keys (`ERA-1`..`ERA-5`).
- **Trash & Recovery (`/trash`):** Lists soft-deleted work items and diagrams across projects, with All / Work items / Diagrams filters, text search, and 1-click Restore (sets `deleted_at` to `null` in localStorage). Diagrams appear once a delete action exists; nothing soft-deletes them yet.
- **Database Schema:** Ready at `supabase/schema.sql` (5 tables: `workspaces`, `workspace_members`, `projects`, `work_items`, `diagrams`).

## Next Priority Queue
1. **Supabase Cloud Connection & Live Auth:** Deploy schema to Supabase, configure `.env.local`, add live authentication, and transition from localStorage to cloud persistence.
2. **UI Design / Auto-layout Canvas (`/design`):** Build the design canvas with auto-layout.
3. **Multiplayer Realtime:** Live collaboration between Marvin and his friend.
