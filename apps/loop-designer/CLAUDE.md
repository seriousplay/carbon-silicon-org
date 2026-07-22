# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**碳硅回路设计师** (Carbon-Silicon Loop Designer) - A Next.js sub-application that helps users design business loops through a 5-step conversation flow. The app guides users to transform real business value streams into executable human-AI closed-loop solutions.

- **Type**: Next.js 16 standalone app (sub-application under `carbon-silicon-org-book`)
- **Port**: 3010 (local), production runs at `/loop-designer` path
- **Language**: TypeScript + React with Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Auth**: Feishu (Lark) OAuth integration
- **Deployment**: PM2 + Nginx

## Tech Stack

- **Framework**: Next.js 16.2.6 (App Router, standalone output)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4 + custom CSS variables
- **Database**: Supabase (postgres)
- **Auth**: Feishu OAuth (custom session-based)
- **AI/LLM**: OpenAI-compatible API (supports Step Router and other `/v1/chat/completions` endpoints)
- **Export**: Puppeteer (PDF), Feishu Docs API
- **Package Manager**: npm

## Project Structure

```
apps/loop-designer/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── api/                      # API route handlers
│   │   │   ├── auth/                 # Auth endpoints (login, logout, callback)
│   │   │   └── sessions/             # Session CRUD + exports
│   │   │       ├── [sessionId]/
│   │   │       │   ├── answer/       # Submit step answer
│   │   │       │   ├── generate/     # Generate final plan from context
│   │   │       │   ├── refine/       # Refine existing plan
│   │   │       │   └── exports/      # Export endpoints (feishu, markdown, pdf, link)
│   │   │       └── route.ts          # Create/list sessions
│   │   ├── auth/                     # Auth pages (error)
│   │   ├── sessions/
│   │   │   └── [sessionId]/          # Session workspace page
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Home page (session list)
│   │   └── globals.css               # Global styles + theme vars
│   ├── components/                   # React components
│   │   ├── designer-workspace.tsx    # Main session editor (17KB - core UI)
│   │   ├── new-session-button.tsx    # CTA to start new session
│   │   └── organization-architecture.tsx  # Org mapping visualization
│   └── lib/                          # Core business logic (server-only)
│       ├── api-response.ts           # Standardized API response types
│       ├── app-session.ts            # Session management (encrypted cookies)
│       ├── auth-crypto.ts            # Encryption utilities for auth
│       ├── auth.ts                   # Auth helpers (requireUser, getCurrentUser)
│       ├── conversation.ts           # 5-step conversation flow definition
│       ├── export-auth.ts            # Export authorization
│       ├── feishu.ts                 # Feishu API client
│       ├── feishu-auth.ts            # Feishu OAuth flow
│       ├── feishu-document.ts        # Feishu doc creation/editing
│       ├── markdown.ts               # Plan → Markdown converter
│       ├── model.ts                  # LLM integration (chat completions)
│       ├── organization-export.ts    # Organization map export logic
│       ├── pdf.ts                    # PDF generation (Puppeteer)
│       ├── plan-parser.ts            # Parse LLM output into LoopPlan
│       ├── plan-schema.ts            # LoopPlan Zod schema + validation
│       ├── sessions.ts               # Session CRUD operations
│       └── supabase.ts               # Supabase client initialization
├── supabase/
│   └── migrations/
│       └── 202606060001_feishu_identity.sql  # DB schema
├── feishu-dist/                      # Feishu mini-app distribution
├── feishu-publish/                   # Feishu published app artifacts
├── scripts/
│   └── prepare-standalone.mjs        # Post-build: copy static assets
├── .env.example                      # Environment template
├── ecosystem.config.cjs              # PM2 production config
├── next.config.ts                    # Next.js config (basePath: /loop-designer)
├── tsconfig.json                     # TS config with @/ path alias
├── eslint.config.mjs                 # ESLint config (Next.js + TypeScript)
└── package.json
```

### Key Architecture Patterns

1. **Server-Only Modules**: All `src/lib/*.ts` files use `import "server-only"` to prevent client-side bundling
2. **API Route Handlers**: RESTful endpoints under `/api/sessions/*` for session lifecycle
3. **Conversation Flow**: Fixed 5-step wizard (loop type → stages → pain points → org mapping → target)
4. **Plan Generation**: LLM-generated JSON → parsed via Zod → stored in session outputs
5. **Export Pipeline**: Single session can export to Markdown, PDF, or Feishu Doc
6. **Auth Flow**: Feishu OAuth → encrypted session cookie → requireUser middleware

## Development Commands

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env.local

# 3. Edit .env.local with real credentials (see Environment Variables section)
```

### Local Development

```bash
# Start dev server on port 3010
npm run dev

# Access at http://localhost:3010/loop-designer
```

### Building

```bash
# Production build (standalone mode)
npm run build
# This runs: next build && node scripts/prepare-standalone.mjs
# Output goes to .next/standalone/

# Start production server
npm start
# Or use PM2: pm2 start ecosystem.config.cjs
```

### Linting & Formatting

```bash
# Run ESLint
npm run lint

# Auto-fix with ESLint
npm run lint -- --fix
```

### Testing

```bash
# Run all tests
npm test
# Runs: tsx --test src/lib/*.test.ts

# Test files follow pattern: *.test.ts in src/lib/
# Uses Node.js built-in test runner (node:test) + assert/strict
```

## Environment Variables

See `.env.example` for all required variables:

### App Configuration

- `NEXT_PUBLIC_SITE_URL` - URL of the main tools site (e.g., `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role (server-only, never expose to client)

### LLM Configuration

- `MODEL_BASE_URL` or `MODEL_API_URL` - API endpoint (OpenAI-compatible `/v1/chat/completions`)
  - Example: `https://api.stepfun.com/step_plan/v1/chat/completions`
- `MODEL_API_KEY` - API key for LLM service
- `MODEL_NAME` - Model identifier (e.g., `step-router-v1`)
- `MODEL_TIMEOUT_MS` - Request timeout (default: 300000 = 5 minutes)

### PDF Generation

- `CHROMIUM_EXECUTABLE_PATH` - Path to Chromium binary for Puppeteer (e.g., `/usr/bin/chromium`)

### Feishu (Lark) Integration

- `FEISHU_APP_ID` - Feishu app ID
- `FEISHU_APP_SECRET` - Feishu app secret
- `FEISHU_ALLOWED_TENANT_KEY` - Tenant allowlist for security
- `FEISHU_EXPORT_FOLDER_TOKEN` - Shared folder token for doc exports

### Auth Session Security

- `LOOP_AUTH_SESSION_SECRET` - Min 32-char random string for encrypting session cookies
- `LOOP_AUTH_SESSION_TTL_SECONDS` - Session duration (default: 1209600 = 14 days)

## Database Schema

Supabase tables (defined in `supabase/migrations/202606060001_feishu_identity.sql`):

1. **`loop_designer_users`** - Feishu user identity
   - Primary key: `id` (uuid)
   - Unique: `(tenant_key, open_id)`
   - Fields: `display_name`, `avatar_url`, `status` (active/disabled)

2. **`loop_designer_auth_sessions`** - Encrypted auth tokens
   - Foreign key: `user_id` → `loop_designer_users.id`
   - Fields: `token_hash` (unique), `expires_at`, `revoked_at`
   - Indexes: `(user_id, created_at desc)`, `(expires_at)` where not revoked

3. **`loop_designer_sessions`** - Design session data
   - Foreign key: `user_id` → `loop_designer_users.id`
   - JSONB fields: `context`, `responses`, `outputs`
   - Status enum: `in_progress | generating | submitted | failed`
   - Index: `(user_id, created_at desc)`

All tables have **Row Level Security (RLS)** enabled with restrictive policies.

## Core Concepts

### Session Lifecycle

1. **Create** → `POST /api/sessions` creates session with welcome message
2. **Answer** → `POST /api/sessions/[id]/answer` submits step response
3. **Generate** → `POST /api/sessions/[id]/generate` calls LLM to produce LoopPlan
4. **Refine** → `POST /api/sessions/[id]/refine` regenerates with user instructions
5. **Export** → `GET /api/sessions/[id]/exports/{markdown|pdf|feishu}`

### 5-Step Conversation Flow

Defined in `src/lib/conversation.ts`:

1. **选定回路** (loop) - Choose loop type, define value stream boundaries
2. **拆解价值流** (stages) - Map current state across 5 stages
3. **定位阻塞** (pain) - Identify bottlenecks and root causes
4. **组织映射** (organization) - Map roles, agents, systems, and handoffs
5. **定义目标** (target) - Define 60-day vision and metrics

### LoopPlan Schema

Defined in `src/lib/plan-schema.ts` (Zod validation):

- **Core**: `title`, `executiveSummary`, `loopType`, `valueFlow`
- **Stages**: Array of 5 stages with `currentState`, `aiDesign`, `humanRole`, `aiParticipation%`, `hitlTrigger`, `successSignal`
- **HITL Nodes**: Human-in-the-loop checkpoints with `owner`, `authority`, `trigger`, `tool`
- **Organization Map**: `humanRoles`, `agentRoles`, `interfaces`, `conflicts`, `roleChanges`
- **Governance**: `kpis` (array of `{name, current, target, cadence}`), `arbitrationRules`, `interlocks`, `lifecycleRule`
- **Roadmap**: 4-week implementation plan with `actions`, `milestone`, `checkpoint`

### LLM Integration

- **File**: `src/lib/model.ts`
- **System Prompt**: Enforces strict JSON output, 5-stage structure, role-based org mapping (no job titles)
- **Parsing**: `src/lib/plan-parser.ts` extracts JSON from LLM output with fallback parsing
- **Validation**: `src/lib/plan-schema.ts` validates against LoopPlan Zod schema

## Code Conventions

### TypeScript

- Strict mode enabled (`"strict": true` in tsconfig)
- Use `@/` path alias for `src/`
- Server components by default; mark client components with `"use client"` directive
- All lib files: `import "server-only"` to prevent client bundling

### Naming

- **Components**: PascalCase (e.g., `DesignerWorkspace`, `NewSessionButton`)
- **Files**: kebab-case for components, camelCase for lib files
- **Tests**: `*.test.ts` suffix

### Styling

- Tailwind CSS v4 utility classes
- Custom CSS variables in `globals.css`:
  - `--ink`: Background dark (#08110f)
  - `--paper`: Text light (#e9f0e8)
  - `--acid`: Accent green (#b7f34a)
  - `--signal`: Accent orange (#ff6a3d)
  - `--cyan`: Accent cyan (#62d9cf)
- Custom classes: `.panel`, `.field`, `.mono`, `.rise` (animation)

### API Routes

- Route handlers: `export async function GET/POST/PUT/DELETE(request) { ... }`
- Server-only by default (Next.js App Router)
- Auth check: `const user = await requireUser("/loop-designer/...")`
- Standard response: `src/lib/api-response.ts` provides `success()`, `error()` helpers

## Feishu Integration

This app is a **Feishu mini-app** with two distribution modes:

1. **`feishu-dist/`** - Development/test distribution (HTML + auth QR)
2. **`feishu-publish/`** - Production published app

Key capabilities:
- **OAuth**: `src/lib/feishu-auth.ts` handles login flow via `/api/auth/feishu/*`
- **Doc Export**: `src/lib/feishu-document.ts` creates/edits Feishu docs with generated plans
- **Permissions**: Requires Feishu app with document creation/edit scopes

## Common Development Tasks

### Adding a New Export Format

1. Create `src/app/api/sessions/[sessionId]/exports/{format}/route.ts`
2. Add export logic in `src/lib/{format}.ts`
3. Update `SessionOutputs` type in `src/lib/session-types.ts`
4. Add UI button in `src/components/designer-workspace.tsx`

### Modifying Conversation Steps

1. Edit `CONVERSATION_STEPS` array in `src/lib/conversation.ts`
2. Update `isCollectionComplete()` logic if step count changes
3. Adjust frontend step indicator in `designer-workspace.tsx`

### Changing LLM Prompt

1. Edit `SYSTEM_PROMPT` or `OUTPUT_SHAPE` in `src/lib/model.ts`
2. Update Zod schema in `src/lib/plan-schema.ts` if output structure changes
3. Update parser in `src/lib/plan-parser.ts` if JSON extraction logic needs adjustment
4. **Test thoroughly**: Plan parsing is fragile with LLM JSON output

## Testing

Tests use Node.js built-in test runner (`node:test`):

```bash
# Run all tests
npm test

# Example test file: src/lib/plan.test.ts
# - Tests plan → Markdown conversion
# - Tests JSON parsing and validation
# - Uses assert/strict for assertions
```

**Current test files**:
- `src/lib/plan.test.ts` - Plan schema and markdown export
- `src/lib/conversation.test.ts` - Conversation step logic
- `src/lib/auth-crypto.test.ts` - Encryption utilities
- `src/lib/feishu-document.test.ts` - Feishu doc operations
- `src/lib/api-response.test.ts` - API response helpers

## Deployment

### Production Build

```bash
npm ci
npm run build
pm2 start ecosystem.config.cjs
```

### Nginx Configuration

Nginx must **preserve the `/loop-designer/` path prefix**:

```nginx
location /loop-designer/ {
  proxy_pass http://127.0.0.1:3010/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

**Do not strip the path prefix** - Next.js `basePath` configuration requires the full URI.

### PM2 Process

Managed by `ecosystem.config.cjs`:
- **Name**: `carbon-silicon-loop-designer`
- **Script**: `.next/standalone/apps/loop-designer/server.js`
- **Port**: 3010
- **Autorestart**: true (max 10 restarts)
- **Memory limit**: 1G
- **Logs**: `./logs/combined.log`, `./logs/out.log`, `./logs/error.log`

## Important Notes

### Security

- **Never commit** `.env.local` - contains API keys and secrets
- `SUPABASE_SERVICE_ROLE_KEY` has full database access - treat as highly sensitive
- `LOOP_AUTH_SESSION_SECRET` must be ≥32 random characters
- All database queries use service role client (server-only)
- RLS policies restrict data access per user

### Data Privacy

- User data: Feishu identity (`open_id`, `display_name`, `avatar_url`)
- Session data: Business context (value streams, pain points, org maps)
- **GDPR consideration**: Data stored in Supabase, may need user deletion workflow

### LLM Output Handling

- LLM output is **not trusted** - always validated via Zod schema
- Parser (`plan-parser.ts`) has multiple fallback strategies for malformed JSON
- Generate/refine endpoints have 300s timeout (configurable via `MODEL_TIMEOUT_MS`)
- Session status set to `"failed"` on generation errors

### Supabase Migrations

Migration file: `supabase/migrations/202606060001_feishu_identity.sql`

To apply new migrations:
```bash
# Via Supabase CLI (if configured)
supabase migration up

# Or manually via Supabase dashboard SQL editor
```

### Parent Repository

This is a **sub-application** within `carbon-silicon-org-book`:
- **Root**: `/Users/heyiqing/Documents/GitHub/carbon-silicon-org-book/`
- **Related apps**: `apps/loop-designer/` (this), `apps/carbon-silicon-tools-site/` (main site)
- **Shared config**: Next.js root config handles multi-app deployment

## Troubleshooting

### "Module not found: @/..."

Ensure `tsconfig.json` has the path alias:
```json
{ "paths": { "@/*": ["./src/*"] } }
```

### Build fails with "Cannot find module"

Run `npm ci` to ensure clean install with exact lockfile versions.

### LLM generation timeout

Increase `MODEL_TIMEOUT_MS` in `.env.local` (default: 300000ms = 5 minutes).

### Feishu export fails

1. Check `FEISHU_APP_ID` and `FEISHU_APP_SECRET` are valid
2. Verify app has "create and edit docs" permissions in Feishu open platform
3. Check `FEISHU_EXPORT_FOLDER_TOKEN` points to accessible folder

### Supabase connection errors

1. Verify `NEXT_PUBLIC_SUPABASE_URL` and keys in `.env.local`
2. Check RLS policies allow authenticated access
3. Verify migration has been applied to database

## Related Documentation

- **Main tools site**: Parent app at `../carbon-silicon-tools-site/`
- **Feishu open platform**: https://open.feishu.cn/
- **Next.js docs**: https://nextjs.org/docs
- **Supabase docs**: https://supabase.com/docs
