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
- **Design (`/design`, `/projects/[id]/designs/[fileId]`):** Design files hub (table, search, "+ New design file" dialog) and a 3-panel canvas editor: Layers tree, pan/zoom canvas rendering flexbox Auto Layout, and a Properties panel (direction, gap, padding, align, distribute, Fixed/Hug sizing, fill) with a "Linked tasks" tab that links layers to work items. Inline text editing on double-click; autosaves to localStorage. Starter file: "Exam Reviewer — Quiz & Bubble Sheet UI". Known gaps: single page, no layer deletion, resize handles are display-only, design files not yet in Trash.
- **Database Schema:** Ready at `supabase/schema.sql` (5 tables: `workspaces`, `workspace_members`, `projects`, `work_items`, `diagrams`).

## Next Priority Queue
- **Final core milestone: Connect Live Supabase Cloud Database & Auth.** Transition from localStorage to PostgreSQL with RLS and realtime sync: deploy `supabase/schema.sql`, configure `.env.local`, add live authentication, move work items, diagrams, and design files to cloud persistence, and enable realtime collaboration (Supabase Realtime).
