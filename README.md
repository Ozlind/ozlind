# OZLIND AI

An independent, premium AI assistant: real streaming chat across four modes
(**Fast**, **Pro**, **Vision**, **Research**, plus an **Auto** router),
cited web research, image/file understanding, per-user history synced to
Supabase (or local-only for guests), and a distinctive dark UI.

> **Note on stack.** This build runs on this platform's fixed toolchain -
> **Vite + React + TypeScript + Tailwind**, deployed as a static SPA with
> **Vercel serverless functions** in `api/`. It intentionally does **not**
> use Next.js App Router, since that framework is not available in this
> environment. Every route/handler/data-flow requirement from the brief
> (streaming chat, mode-based routing, Supabase persistence + RLS, Tavily
> research, file/vision understanding, health checks, honest
> not-configured states) is implemented with the equivalent Vite/Vercel
> primitives.

## Stack

- Vite 7 + React 19 + TypeScript, Tailwind CSS v4
- `react-markdown` + `remark-gfm` + `rehype-sanitize` for safe markdown rendering
- `lucide-react` icons
- Vercel serverless functions (`api/*.js`, Node 22) for all backend logic
- Supabase (Postgres + Auth) via `@supabase/supabase-js` — no ORM, no raw SQL from the client
- `pdf-parse` for server-side PDF text extraction

## Project layout

```
api/
  chat.js            AI chat, SSE streaming, mode routing + fallback
  research.js        Tavily web search → cited sources
  files.js           Upload validation + text/PDF extraction
  health.js          Per-service configured:true/false (no secrets)
  conversations.js   CRUD for chat threads (RLS-scoped, requires auth)
  messages.js        CRUD for messages (RLS-scoped, requires auth)
  settings.js        Per-user settings (RLS-scoped, requires auth)
  profile.js         Upserts a profile row on first sign-in
  _lib/providers.js  Provider routing, prompts, retry/fallback rules
  _lib/tavily.js      Tavily client
  _lib/validate.js    Server-side input validation
  _lib/ratelimit.js   Simple in-memory rate limiting
  db-client.js       Pre-provided Supabase service-role client (untouched)
src/
  App.tsx                    Top-level state: auth, conversations, streaming
  contexts/AuthContext.tsx   Supabase session state + magic-link sign-in
  components/                Sidebar, ChatWorkspace, MarkdownMessage, dialogs
  lib/                       supabase client, api fetch/stream helpers, storage
supabase/schema.sql          Full schema + RLS policies (reference copy)
tests/verify.js              Post-deploy smoke tests (honest skip on missing keys)
```

## Environment variables

Copy `.env.example`. All AI provider keys are **optional** — missing keys
never crash the app; `/api/health` reports that service as `configured:
false` and the UI shows a safe "not configured" message instead of a fake
response.

| Variable | Required | Notes |
|---|---|---|
| `GROQ_API_KEY` | optional | Powers **Fast** mode |
| `GROQ_MODEL` | optional | Default: `llama-3.3-70b-versatile` |
| `GEMINI_API_KEY` | optional | Powers **Pro**, **Vision**, and grounds **Research** |
| `GEMINI_TEXT_MODEL` | optional | Default: `gemini-2.5-pro` |
| `GEMINI_VISION_MODEL` | optional | Default: `gemini-2.5-flash` |
| `EXPERIENTIAL_API_KEY` / `EXPERIENTIAL_MODEL` / `EXPERIENTIAL_BASE_URL` | optional | OpenAI-compatible extra text fallback; only activates if **all three** are set |
| `TAVILY_API_KEY` | optional | Powers **Research** mode's cited sources |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | required for persistence/auth | Already provisioned in this workspace |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | required for persistence/auth | Client-side copies used by the Vite build |

Add missing keys via the platform's **Secrets** tab — they apply on the next deploy automatically.

## Database

Run `supabase/schema.sql` on a fresh Supabase project to reproduce the
schema (in this workspace it was already created via the platform's table
tooling, which is equivalent). Tables: `profiles`, `conversations`,
`messages`, `user_settings` — all UUID-keyed, indexed, timestamped, and
protected by Row Level Security so a user can only read/write their own
rows.

## Local development

```bash
npm install
npm run dev
```

API routes only run on Vercel (dev or prod) — pure `vite dev` will serve the
SPA but `/api/*` calls will 404 locally unless you also run `vercel dev`.

## Building

```bash
npm run build
```

## Modes & routing (server-side, never exposed to the UI)

- **Auto** — picks Vision when an image is attached, Research when the
  message implies a need for current information, otherwise Fast or Pro
  based on message complexity.
- **Fast** — Groq, low latency, concise.
- **Pro** — Gemini's strongest text model, deeper reasoning.
- **Vision** — Gemini multimodal for images/screenshots/files.
- **Research** — Tavily search first, then a cited answer grounded only in
  the returned sources; if none are configured/found, the app says so
  honestly instead of fabricating sources.

Fallback only triggers on temporary failures (HTTP 429/5xx or network
errors) and never on invalid input, bad auth, or missing configuration —
those surface as a clear, safe message instead of silently retrying.

## What was verified

- `npm run build` (TypeScript project build + Vite bundle) passes cleanly.
- Every API route was read through end-to-end for CORS headers, input
  validation, and safe error handling.
- The frontend streaming client, message state machine (send / stop /
  regenerate / edit), and localStorage/Supabase dual persistence paths were
  written and reviewed for logical correctness.

## What was **not** verified (be honest about this)

- No AI provider keys are configured in this workspace yet, so real
  end-to-end model responses, streaming over the network, and the research
  citation flow have **not** been exercised against live provider APIs.
  `tests/verify.js` will report those specific checks as **skipped**, not
  passed, until keys are added.
- The magic-link email sign-in round trip requires a real inbox and was not
  clicked through in this environment.
- Run `BASE_URL=<deployed-url> node tests/verify.js` after deploy to smoke
  test the live app; it clearly labels skipped vs. passed vs. failed checks.
