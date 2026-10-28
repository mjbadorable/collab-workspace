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

---

## 📁 Project Structure

```
collab-workspace/
├── src/
│   ├── app/                                 # Next.js App Router routes
│   │   ├── api/
│   │   │   ├── github-breakdown/route.ts    # GitHub repository parser & task extractor
│   │   │   └── health-check/route.ts        # SSRF-guarded production latency pinger
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
