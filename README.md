# Silph DevOps — Collaborative Engineering Portal (`collab-workspace`)

> **Architecture Style:** Cloud-Ready & Local-First Collaborative DevOps Control Plane  
> **Live Production App:** [https://collab-workspace-mu.vercel.app](https://collab-workspace-mu.vercel.app)  
> **Stack:** Next.js 16 (Turbopack) · React 19 · Tailwind CSS v4 · TypeScript · Supabase (PostgreSQL + RLS) · React Flow (`@xyflow/react`)

---

## ⚡ Overview

**Silph DevOps (`collab-workspace`)** is a developer control plane designed to plan, architect, monitor, and manage decoupled software projects from a single unified portal. 

Instead of embedding sub-projects directly into the workspace codebase, the portal functions as an independent **monitoring and command center**: you can plug in any external project or public GitHub repository to automatically break down its tech stack, discover open roadmap tasks, visualize end-to-end process flows, and monitor production uptime in real time.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technologies Used | Key Responsibilities & Capabilities |
|---|---|---|
| **Frontend & UI** | Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons | Partial Prerendering (PPR), Turbopack builds, responsive mobile drawer, Pokémon League theme, zero hydration errors |
| **Process Flows & Diagrams** | React Flow (`@xyflow/react`) | Categorized read-only architectural visualizer (User Flow, System Flow, Backend Flow) with minimap, zoom/pan controls, and 1-click Mermaid export |
| **Cloud Backend & Database** | Supabase (PostgreSQL), Supabase Auth, Row-Level Security (RLS) | `SECURITY DEFINER` stored procedures, granular RLS policies, teammate invitation system, realtime WebSocket channels |
| **Local Persistence & Resilience** | Browser `localStorage` with reactive `useSyncExternalStore` | 100% offline-first preview mode, client-side WebP image compression (<40 KB) |
| **DevOps & Infrastructure** | Vercel CI/CD, GitHub, SSRF-Guarded Health API (`/api/health-check`) | Automated production deploys on git push, continuous latency and HTTP status monitoring |

---

## 🚀 Key Features

### 1. Multi-Project Control Plane
- Dynamic collapsible sidebar tree for every registered project.
- Projects Hub with live search, **All Projects** and **Joined** tabs, task completion progress meters, and direct links to GitHub repositories and live deployments.

### 2. Plug & Play GitHub Breakdown API (`/api/github-breakdown`)
- Paste any public GitHub repository link (e.g. `https://github.com/mjbadorable/Mastersoft-Grade-Encoding-Assistant`) into the **Create project** modal.
- The system automatically parses `package.json` and `README.md` to:
  - Detect project name, icon, and uppercase identifier (e.g. `MGEA`, `ERA`).
  - Extract the live deployment URL and description.
  - Automatically populate the **Frontend and Backend tech stack table**.
  - Scan roadmap and feature tables to pre-populate initial work items on the Kanban board.

### 3. Live Production Health Monitoring
- Active status monitor pings registered production URLs via `/api/health-check`.
- Real-time indicator displaying status code (`200 OK`) and latency in milliseconds (`Latency ~142ms`).
- SSRF protection rejecting non-HTTP(S) schemes and private/link-local IP addresses.

### 4. Agile Work Items & Kanban Board
- 3-column Kanban board (**Backlog**, **In Progress**, **Done**) with native HTML5 drag-and-drop.
- List view with status filter tabs and priority indicators (High, Medium, Low).
- Global keyboard shortcut (`C`) to quickly create work items from anywhere.
- Deep-linking from the Home Dashboard metric cards directly into filtered tasks (`?status=in_progress`, `?status=done`).

### 5. Smart Categorized Process Flow Visualizer (`/projects/[id]/diagrams`)
- Read-only visual diagrams organized into three dedicated categories:
  - 👤 **User Flow:** End-to-end user journey across the application.
  - ⚙️ **System Flow:** Internal runtime execution, state transitions, and worker threads.
  - 🗄️ **Backend & Storage Flow:** Data persistence, cache tiers, and deployment delivery.
- Includes a **Raw Mermaid Code** drawer with a 1-click copy button for embedding into Markdown documentation.

### 6. Personalized Profile & Pokémon League Titles
- Client-side image resizer for profile picture uploads (compressed to WebP with 64px Supabase thumbnail sync).
- Customizable **Pokémon League Title** cosmetic badges:
  - 🧢 Trainer · 🏅 Gym Leader · 🔬 Professor · 🏆 Champion · 🌟 Elite Four · ⚡ Pokémon · 🚀 Team Rocket · 🧭 Ace Trainer · ⚔️ Rival · 🥋 Battle Legend
- 10 quick-pick bio suggestions for full-stack developers and systems architects.

### 7. Live Local Dev & Git Push Monitor (`/api/local-git-status`)
- Reads the working tree the dev server runs from — branch, uncommitted files, commits ahead of `origin` — and polls it every 10 seconds while the tab is visible.
- Amber pulsing banner when commits are waiting, with a 1-click **Copy `git push origin <branch>`** button and the pending commit subjects.
- Collapsible list of uncommitted files, plus the latest commit sha, subject and age.
- The route answers `{ isLocal: false }` off localhost, so the deployed app shows a `☁️ Cloud Deployment (Vercel)` badge instead of shelling out to git.
- **Fleet mode (CW-43):** `?all=true` reads `collab-workspace`, `exam-reviewer-app` and `mastersoft-grade-encoding-assistant` from their folders on the dev machine; `?project=<id>` reads one. The Home dashboard shows a fleet tab bar (`All Fleet` summary grid + one tab per repo, yellow dot when a repo has pending work); a project overview shows only its own repo with its folder path and a `git -C "<path>" push origin <branch>` copy button. A folder only counts if it is itself a git work-tree root, and a repo that is missing on disk is reported as `notFound` rather than an error.

### 8. Cloud Device Handoff & Memory Vault (`/api/device-handoff`)
- Packs every `collab-workspace:` key on the device plus a **session memo** into one snapshot and parks it in a server-memory locker under a 6-character code (no I/O/0/1), good for 30 minutes.
- The other machine types the code, previews the snapshot (device, capture time, memo, key count) and restores it in one click; the vault copy is burned afterwards.
- `.json` download and import as the durable fallback — a redeploy or cold start clears the in-memory locker.
- **1-click transfer link (CW-44):** after a push, *Copy 1-Click Link* copies `<origin>/?handoff=<code>`. Opening it on the other device opens the modal on **Receive** with the code already fetched, so only **Restore Snapshot** is left. The parameter is stripped from the address bar immediately. (A link made from `localhost` only works on that machine; use the deployed app's address.)
- Named devices (Edtech-03 ⇄ Laptop) and a **memory vault log** of the last 12 handoffs with their memos. A restore never overwrites the receiving device's own name or history.

### 9. PWA Manifest & Connectivity Sentinel
- `public/manifest.json` (standalone display, dark theme colors) linked from the root layout metadata.
- `NetworkStatusBar` listens to the browser `online` / `offline` events: an amber *Offline mode — changes saved locally in browser* pill slides in on disconnect, and a green *Reconnected — cloud sync resumed* pill shows for 4 seconds when the connection returns.

---

## 📁 Project Structure

```
collab-workspace/
├── src/
│   ├── app/                                 # Next.js App Router routes
│   │   ├── api/
│   │   │   ├── device-handoff/route.ts      # Short-lived cloud locker for device-to-device handoffs
│   │   │   ├── github-breakdown/route.ts    # GitHub repository parser & task extractor
│   │   │   ├── health-check/route.ts        # SSRF-guarded production latency pinger
│   │   │   └── local-git-status/route.ts    # Local-only branch, uncommitted & unpushed commit reader
│   │   ├── projects/
│   │   │   └── [id]/
│   │   │       ├── architecture/page.tsx    # Technical 4-layer system architecture blueprint
│   │   │       ├── diagrams/page.tsx        # Categorized process flow viewer (User/System/Backend)
│   │   │       ├── settings/page.tsx        # Project settings & Work item types
│   │   │       ├── work-items/page.tsx      # Kanban board & task list
│   │   │       └── page.tsx                 # Project Overview & Tech Stack table
│   │   ├── settings/page.tsx                # Workspace & user profile settings
│   │   ├── login/page.tsx                   # Supabase Auth split-screen login page
│   │   └── page.tsx                         # Interactive command center Home dashboard
│   ├── components/                          # React client components
│   │   ├── diagrams/                        # Process flow canvas & custom node types
│   │   ├── home/                            # Dashboard stats, project cards, health pills
│   │   ├── projects/                        # Project creation modal & overview layouts
│   │   ├── settings/                        # Profile editor, avatar resizer, member invites
│   │   └── work-items/                      # Kanban columns, drag-and-drop, task forms
│   └── lib/                                 # State management & utilities
│       ├── auth-context.tsx                 # Supabase Auth provider
│       ├── profile-context.tsx              # Local & cloud user profile sync
│       ├── projects-context.tsx             # Project store with localStorage fallback
│       ├── diagram-storage.ts               # Categorized process flows & Mermaid generator
│       └── work-items-storage.ts            # Work item persistence & sequence generator
├── supabase/
│   ├── schema.sql                           # Core PostgreSQL schema & RLS policies
│   ├── invite.sql                           # Teammate invitation procedures
│   └── projects.sql                         # Multi-project columns migration
└── public/                                  # Static icons and assets
```

---

## 📋 Initial Roadmap Tasks

| Key | Title | Status | Priority |
|---|---|---|---|
| `CW-1` | Real-time Supabase Realtime channel listener for multi-user Kanban sync | Done | High |
| `CW-2` | Automated GitHub commit and pull request activity widget in project overview | Done | Medium |
| `CW-3` | Workspace-level member role permissions (Admin vs Member granular gates) | Done | Medium |
| `CW-4` | Export project telemetry and architecture blueprint as printable PDF report | Done | Low |
| `CW-5` | Plug & Play GitHub repo breakdown and auto-task generation | Done | High |
| `CW-6` | Command Palette (Ctrl+K / Cmd+K) for instant project, ticket, and diagram navigation | Done | High |
| `CW-7` | Automated Uptime History Sparkline & Webhook Alerts (Discord/Slack) on health check failure | Done | High |
| `CW-8` | GitHub PR & Deployment Environment Statuses (Vercel preview links) in Commit Stream | Done | Medium |
| `CW-9` | Kanban Keyboard Shortcuts, Due Dates, and Sub-task Checklists on Work Items | Done | Medium |
| `CW-10` | Cross-Project Portfolio Command Center on the Home Dashboard | Done | High |
| `CW-11` | Inline Kanban Sub-tasks, Color-Coded Type Labels, and Target Due Dates | Done | Medium |
| `CW-12` | Discord/Slack Webhook Alerts and In-App Activity Feed Bell | Done | High |
| `CW-13` | Interactive Architecture & Flowchart Node Inspector with Runbook Notes | Done | Medium |
| `CW-14` | Project Analytics & Velocity Dashboard with pure-SVG charts | Done | Medium |
| `CW-15` | Dark Mode Theme Switcher: Poké-Center Light vs. Silph Co. Dark | Done | Low |
| `CW-16` | Sprint Cycles & Iteration Planner (/projects/[id]/cycles) | Done | High |
| `CW-17` | Functional Feature Epics & Architecture Modules (/projects/[id]/modules) | Done | High |
| `CW-18` | Live Project Scratchpad & Realtime Team Room dock | Done | Medium |
| `CW-19` | 1-Click CSV & JSON Bulk Import and Export on Work Items | Done | Medium |
| `CW-20` | Git Commit Linking & PR Direct Resolver on Work Items | Done | Medium |
| `CW-21` | Cloud-to-Local read-through sync for Home Portfolio and Command Palette | Done | High |
| `CW-22` | Sprint Burndown Chart with automated completion timestamps on Cycles | Done | High |
| `CW-23` | Interactive Flowchart Step Editor for custom user, system, and backend flows | Done | Medium |
| `CW-24` | Kanto Gym Badge Case & Engineering XP gamification system | Done | Low |
| `CW-25` | 1-Click Full Workspace Snapshot Backup and Restore (.json) | Done | Medium |
| `CW-26` | Pomodoro Focus Timer dock linked to active Kanban work items | Done | Medium |
| `CW-27` | Interactive System Architecture Layer Editor (/projects/[id]/architecture) | Done | Medium |
| `CW-28` | Release Changelog & Semantic Version Tag Generator with Markdown export | Done | Medium |
| `CW-29` | Ticket Blocker Dependencies (⛔ Blocked by) and in-ticket comment logs | Done | Medium |
| `CW-30` | Pokédex Dossier 5-axis technical radar and fleet technology matrix | Done | Medium |
| `CW-31` | Daily Standup & Executive Digest Generator on Home Dashboard | Done | Medium |
| `CW-32` | Global Keyboard Shortcut Cheat-sheet (?) and milestone celebration burst | Done | Low |
| `CW-33` | Two-row sidebar trainer footer so the display name and role badge are never cramped | Done | Medium |
| `CW-34` | Collapsible Workspace Roadmap grid showing the six newest milestones | Done | Low |
| `CW-35` | Collapsible desktop sidebar toggle for full-width boards and diagrams | Done | Low |
| `CW-36` | Label and Cycle filter dropdowns on the Work Items toolbar | Done | Medium |
| `CW-37` | Priority, Assignee and Blocked-only filters with sort order on the Work Items toolbar | Done | Medium |
| `CW-38` | 60-second health heartbeat with re-check button and latency telemetry popover | Done | High |
| `CW-39` | 1-click Assign Tickets pickers on Cycle and Module cards | Done | Medium |
| `CW-40` | Deep-dive engineering analytics: 14-day velocity, cycle and module progress, hygiene scorecard | Done | Medium |
| `CW-41` | Live local dev & git push monitor with unpushed-commit banner and 1-click push command | Done | High |
| `CW-42` | Cloud Device Handoff & Memory Vault for office-PC to laptop session transfer | Done | High |
| `CW-43` | Fleet multi-repo local dev & git monitor across collab-workspace, exam-reviewer-app and the grade assistant | Done | High |
| `CW-44` | 1-click shareable transfer link and auto-receive URL handler for Device Handoff | Done | Medium |
| `CW-45` | PWA manifest and real-time offline/online connectivity sentinel banner | Done | Medium |
| `CW-46` | Durable Supabase Device Handoff Table with automatic in-memory fallback for cold starts | Done | High |
| `CW-47` | Vercel Edge Caching & API Rate-Limit Armor for GitHub and health telemetry | Done | Medium |
| `CW-48` | Dual Environment Switcher: Production vs Staging/Testing mode with localStorage persistence | Done | High |
| `CW-49` | Read-only Local Source Code Inspector with sandboxed file tree and code viewer | Done | High |
| `CW-50` | System Runtime Error Sentinel & Diagnostics Debugger Dock with 1-click Copy Diagnostic | Done | High |

---

## 🏃 Running Locally

```bash
# 1. Clone repository
git clone https://github.com/mjbadorable/collab-workspace.git
cd collab-workspace

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (optional for local preview mode)

# 4. Start Turbopack development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
