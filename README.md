# OZLIND AI

Next.js 15 (App Router) AI workspace with Supabase Google sign-in,
streaming chat, image understanding and optional live web research.

## Structure

| Path | Purpose |
|---|---|
| `app/page.jsx` | Main page (requires a signed-in user) |
| `app/login/page.jsx` | Google sign-in |
| `app/auth/callback/route.js` | OAuth code exchange |
| `app/api/chat/route.js` | Streaming chat endpoint (SSE) |
| `app/api/supabase/config/route.js` | Public Supabase URL and publishable key for the browser |
| `components/OzlindApp.jsx` | Main client interface |
| `lib/providers.js` | Model routing and streaming |
| `lib/server.js` | Validation, system prompt, safe errors |
| `lib/rate-limit.ts` | Per-user request limiter (Supabase, with in-memory fallback) |
| `lib/cloud.js` | Saves and loads conversations and settings in Supabase |
| `app/api/account/delete/route.js` | Permanent account deletion |
| `lib/supabase/*` | Supabase browser and server clients |
| `middleware.js` | Auth gate for pages and APIs |
| `constants/`, `types/` | Shared modes, limits, settings and types |
| `supabase/schema.sql` | Complete database: tables, search, sharing, usage, documents (pgvector), admin, storage, row-level security |

## Environment variables

Set in `.env.local` locally or in Vercel project settings. See `.env.example`.

`GROQ_API_KEY`, `GROQ_FAST_MODEL`, `GROQ_PRO_MODEL`, `GEMINI_API_KEY`,
`GEMINI_MODEL`, `TAVILY_API_KEY` (optional), `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.

Never prefix these with `NEXT_PUBLIC_`. Never expose the secret key or
provider keys to the browser.

## Supabase setup

1. Run `supabase/schema.sql` in the Supabase SQL editor. It only adds things, never deletes, and is safe to run again. If it is too long to paste at once, run it one numbered section at a time.
   To become an admin, run the `update public.profiles set role = 'admin' ...` line at the bottom of the file with your email.
2. Authentication → Providers → enable Google.
3. Authentication → URL Configuration: set Site URL to your production
   domain and add `https://<your-domain>/auth/callback` to Redirect URLs.
4. Google Cloud Console → OAuth client → add the Supabase callback URL
   shown in the Google provider settings.

## Run

```
npm install
npm run dev
```

Production: `npm run build` then `npm run start`.

Checks: `npm run verify` (imports and structure) and `npm run typecheck`.

## Notes

- Image generation and PDF reading are intentionally not included.
- Chat history and settings are stored in your Supabase account. If the tables are missing, the app falls back to on-device storage.
- Account deletion needs `SUPABASE_SECRET_KEY` on the server.

## First Production Architecture

OZLIND is being rebuilt as a five-stage production system. The implementation is intentionally modular; the legacy OzlindApp.jsx is only a compatibility shell.

1. **Stage 1 — Product foundation**: mobile-first workspace, isolated chat state, sidebar, composer, message renderer, settings, attachments, streaming UI.
2. **Stage 2 — AI application layer**: thin HTTP route, chat application service, provider gateway, live research and private-document context boundaries.
3. **Stage 3 — Data and security**: request correlation, server-only rate-limit execution, RLS-preserving ownership checks, hardened shared-chat lookup, health/readiness.
4. **Stage 4 — Reliability**: repository verification, TypeScript validation, production build gates, architecture line budgets, cancellation and streaming error handling.
5. **Stage 5 — Product polish**: mobile pull-to-refresh, auto-scroll, auto-growing composer, neutral visual system, reduced-motion and safe-area handling.

The production bar is correctness first: new modules are kept only when they have a clear responsibility and are covered by repository/build verification.
