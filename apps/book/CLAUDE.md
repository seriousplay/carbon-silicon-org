# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**碳硅组织工具站** (Carbon Silicon Tools Site) is a Next.js web application that serves as the digital companion to the book 《碳硅组织：AI时代的商业进化论》 (Carbon Silicon Organization: Business Evolution in the AI Era).

The platform provides:
- **Assessment tools** - Online organizational AI maturity assessments (5 modules, 25-35 questions)
- **OD Tool Library** - 21 organization development tools mapped to the book's 12 chapters
- **Personal Reports** - Automated scoring and recommendation generation
- **Admin Dashboard** - Workshop facilitators can manage assessment runs and view aggregated anonymous reports
- **Mixed-mode support** - Workshops, corporate diagnostics, cohort programs, and public assessments

**Live deployments:**
- Vercel: https://carbon-silicon-tools-site.vercel.app
- Aliyun: http://47.95.199.142/

---

## Tech Stack

### Frontend
- **Framework**: Next.js 16.2.6 (App Router)
- **Language**: TypeScript 5.x (strict mode)
- **UI**: React 19.2.4 + Tailwind CSS 4.x
- **Forms**: React Hook Form 7.75.0 + Zod 4.4.3
- **Charts**: Recharts 3.8.1
- **Icons**: Lucide React
- **Design**: Dark "workbench" aesthetic with glass-morphism components

### Backend & Database
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Project ID**: `uxaxvzqskqsujmlmxvhj`

### Development Tools
- **Linting**: ESLint 9.x with Next.js config
- **Package Manager**: npm

---

## Quick Start

### 1. Install Dependencies

```bash
cd apps/carbon-silicon-tools-site
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key (browser-visible)
- `SUPABASE_SERVICE_ROLE_KEY` - Server-only key (never commit!)
- `NEXT_PUBLIC_SITE_URL` - Site URL (e.g., http://localhost:3000 for dev)

### 3. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

### 4. Initialize Database (if needed)

Execute `supabase/schema.sql` in Supabase SQL Editor to create all tables, RLS policies, and seed data.

---

## Common Commands

### Development

```bash
# Start dev server (hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

### Code Quality

```bash
# Lint all files
npm run lint

# Lint and auto-fix
npm run lint -- --fix

# Type check (implicit in build)
npx tsc --noEmit
```

### Tooling

```bash
# Generate tool documentation markdown from tool-products.json
npm run tools:manuals

# This script: scripts/generate-tool-manuals.mjs
# Outputs to: docs/tool-products/*.md
```

### Database

```bash
# Apply schema changes
# 1. Edit supabase/schema.sql
# 2. Run in Supabase SQL Editor
```

### Deployment

#### Vercel
1. Create new Vercel project
2. Set Root Directory to `apps/carbon-silicon-tools-site`
3. Configure environment variables (see above)
4. Deploy

#### Aliyun Server
```bash
# Deploy to Aliyun (from project root)
cd apps/carbon-silicon-tools-site
./scripts/deploy-aliyun.sh

# Optional: specify SSH key
ALIYUN_KEY=~/.ssh/daodecision_aliyun.pem ./scripts/deploy-aliyun.sh
```

Server stack: Node.js 22 + pm2 + nginx (80 → 3000)

---

## Project Structure

```
apps/carbon-silicon-tools-site/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Homepage
│   │   ├── layout.tsx         # Root layout
│   │   ├── tools/             # Tool library pages
│   │   │   ├── [toolSlug]/    # Individual tool page
│   │   │   └── page.tsx       # Tool listing
│   │   ├── e/[eventSlug]/     # Assessment entry (run entry)
│   │   │   ├── start/         # Participant info form
│   │   │   └── assessment/     # Core questionnaire
│   │   ├── report/[reportId]/ # Personal report display
│   │   ├── admin/             # Admin dashboard
│   │   │   ├── runs/          # Run management
│   │   │   │   ├── new/       # Create new run
│   │   │   │   └── [runSlug]/ # Run detail + report
│   │   │   └── events/        # Legacy event admin (backward compat)
│   │   └── api/               # API route handlers
│   │       ├── assessments/   # Submit assessment
│   │       ├── runs/          # Run CRUD
│   │       └── ...
│   ├── components/            # React components
│   │   ├── ui.tsx             # Core UI (AppShell, GlassCard, etc.)
│   │   ├── tool-use-form.tsx  # Tool usage interface
│   │   ├── admin-run-dashboard.tsx
│   │   └── report-view.tsx
│   ├── lib/                   # Business logic
│   │   ├── assessment/        # Assessment engine
│   │   │   ├── types.ts       # Question, Report, EventSummary types
│   │   │   ├── questions.ts   # Question bank (25-35 questions)
│   │   │   ├── scoring.ts     # Scoring & recommendation logic
│   │   │   ├── server-summary.ts  # Aggregated report generation
│   │   │   └── storage.ts     # Data persistence layer
│   │   ├── auth/              # Authentication utilities
│   │   │   ├── client.ts      # Browser Supabase client
│   │   │   └── server.ts      # Server-side auth helpers
│   │   ├── runs/              # Run management
│   │   │   ├── types.ts       # RunType, RunStatus, AssessmentRun
│   │   │   ├── default-runs.ts # Predefined runs (e.g., 5.17 workshop)
│   │   │   └── server.ts      # Server-side run fetching
│   │   ├── tools/             # Tool library
│   │   │   ├── tool-products.json  # Complete 21-tool catalog
│   │   │   └── tool-library.ts     # Helper functions
│   │   └── supabase/          # Supabase clients
│   │       ├── client.ts      # Browser client
│   │       ├── server.ts      # Server client with service role
│   │       └── admin.ts       # Admin client
│   ├── styles/                # Global styles
│   └── types/                 # Global type definitions
├── supabase/
│   └── schema.sql             # Database schema + RLS policies
├── public/                    # Static assets
├── scripts/                   # Build & deploy scripts
│   ├── deploy-aliyun.sh       # Deploy to Aliyun
│   └── generate-tool-manuals.mjs  # Generate tool docs
├── docs/                      # Project documentation
│   ├── plans/                 # PRD & iteration plans
│   │   ├── 2026-05-09-carbon-silicon-tools-site-prd.md
│   │   └── 2026-05-09-carbon-silicon-tools-site-v0.2-mixed-mode-iteration-plan.md
│   └── tool-products/         # Individual tool documentation (21 .md files)
├── package.json
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
└── .env.example               # Environment template

```

---

## Architecture Highlights

### Assessment Flow

1. **Entry**: `/e/[runSlug]` - Participant lands on event/run page
2. **Basic Info**: `/e/[runSlug]/start` - Name, role, industry, org size
3. **Questionnaire**: `/e/[runSlug]/assessment` - 5 modules, 25-35 questions
4. **Submission**: `POST /api/assessments` - Server-side write to Supabase
5. **Report**: `/report/[reportId]` - Personal report with scores, bottleneck, recommendations

### Assessment Modules

1. **五级阶梯 (Five-Level Ladder)** - 5 questions → AI maturity stage (L0-L5)
2. **三螺旋 (Triple Helix)** - 9 questions → Structure/Cell/Environment layers
3. **意义-权力-信任 (Meaning-Power-Trust)** - 9 questions → Hidden bottleneck diagnosis
4. **人机链路准备度 (Human-AI Chain Readiness)** - 5 questions → Workflow experiment readiness
5. **AI宪章准备度 (AI Charter Readiness)** - 5 questions → Governance clarity

### Scoring Logic (`src/lib/assessment/scoring.ts`)

- Calculates current stage (L0-L5) based on ladder responses
- Computes dimension averages for each module
- Identifies primary bottleneck (lowest scoring dimension)
- Maps recommendations based on stage + bottleneck
- Recommends 2-4 relevant tools from the 21-tool library

### Data Model (Supabase)

**12 core tables:**
- `events` / `runs` - Assessment runs (workshops, diagnostics, cohorts, public)
- `participants` - Participant basic info
- `questions` - Question bank
- `assessments` - Assessment instances
- `assessment_answers` - Individual answers
- `reports` - Generated personal reports
- `tools` - Tool library catalog
- `tool_sessions` - Tool usage sessions
- `organizations` - Organization records (light in V0.2)
- `profiles` - User profiles
- `organization_members` - Org membership
- `organization_invites` - Invitation codes

### Admin Dashboard

Routes under `/admin/runs/`:
- `/admin/runs` - List all runs
- `/admin/runs/new` - Create new run
- `/admin/runs/[runSlug]` - Run detail (stats, access code, export)
- `/admin/runs/[runSlug]/report` - Aggregated anonymous report

Legacy compatibility: `/admin/events/20260517` (for the 5.17 workshop)

---

## Key Design Decisions

- **No LLM in MVP**: Reports use rule-based scoring, not AI generation
- **PDF via Print Stylesheet**: Browser print → Save as PDF (server-side deferred)
- **Anonymous Aggregation**: Workshop summaries are anonymous by default
- **Guest Submission**: Participants can submit without login (via access code)
- **Server-Side Writes**: All assessment submissions go through server route handlers
- **Mixed-Mode Entries**: Single platform supports multiple entry types
- **Organization Layer (Light)**: Optional org context, not mandatory in V0.2

---

## Important Notes

- **Next.js Version**: This project uses Next.js 16.x, which has breaking changes from older versions. Read `node_modules/next/dist/docs/` before writing code.
- **Supabase Security**: `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose to client or commit to git.
- **Schema Changes**: Modify `supabase/schema.sql`, not migrations. Script is idempotent (safe to re-run).
- **Type Safety**: TypeScript strict mode enabled. All new files should include `typed: strict` sorbet annotation if using sorbet (current codebase does not use sorbet).
- **Test Coverage**: No test files in the project yet. Manual QA via the end-to-end path in README.md.
- **Environment Modes**:
  - **With Supabase**: Full functionality (assessments, reports, admin)
  - **Without Supabase**: Local demo mode with sample data (for development)

---

## Related Documentation

- **PRD**: `docs/plans/2026-05-09-carbon-silicon-tools-site-prd.md`
- **V0.2 Plan**: `docs/plans/2026-05-09-carbon-silicon-tools-site-v0.2-mixed-mode-iteration-plan.md`
- **Tool Catalog**: `src/lib/tools/tool-products.json` + `docs/tool-products/*.md`
- **Book Manuscript**: `/全书12章_最新版本_20260508/`
- **Agent Instructions**: `AGENTS.md` (for book polishing workflows)

---

## Support & Troubleshooting

### Common Issues

**"Module not found" errors:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Supabase connection errors:**
- Verify `.env.local` has correct keys
- Check Supabase project is not paused
- Verify RLS policies are correctly applied

**Build errors:**
```bash
npm run lint -- --fix  # Auto-fix ESLint issues
npm run build          # See detailed error messages
```

**Assessment submission fails:**
- Check browser console for client-side validation errors
- Check server logs for Supabase write errors
- Verify `assessments` table exists and RLS allows insert

### Getting Help

- Issues: https://github.com/anthropics/claude-code/issues
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
