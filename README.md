# Ozlind

Ozlind is a mobile-first AI chat application built with Next.js App Router, React, TypeScript, the Vercel AI SDK, and Supabase. This repository contains the application UI, server route handlers, authentication integration, database migrations, and repository verification checks.

## Requirements

- Node.js 20.9 or later, below 25 (see `.nvmrc` and `package.json`)
- npm
- A Supabase project
- At least one configured AI provider: Groq or Google Generative AI

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values required for your enabled features. Never commit `.env.local` or place server secrets in `NEXT_PUBLIC_*` variables.

3. In Supabase, enable the authentication providers you intend to support (Email and Google), and configure the application’s allowed redirect URLs, including `/auth/callback`.

4. Check `supabase/migrations/` and the current database migration history before applying SQL. Migrations are ordered changes; do not blindly re-run them against a populated project. `supabase/schema.sql` is a reference schema snapshot, not a replacement for reviewing migration history.

5. Start the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Verification commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript validation |
| `npm run lint` | ESLint on `src/` |
| `npm run verify:architecture` | Required-file, security-pattern, and architecture checks |
| `npm run build` | Production Next.js build |
| `npm run verify` | Runs typecheck, lint, architecture checks, and production build |

GitHub Actions runs `npm run verify` for pushes to `main` and pull requests targeting `main`. Production dependency audit findings at high severity block CI. The audit retries transient registry failures with bounded timeouts; if the registry is unreachable after three attempts, CI records a warning and continues code verification while explicitly marking dependency status as unverified. Re-run `npm audit --omit=dev --audit-level=high` when registry service recovers.

## Repository map

```text
.
├── .github/workflows/     # CI workflow
├── docs/
│   ├── adr/               # Accepted architecture decisions
│   └── architecture/      # Current file map and ownership boundaries
├── public/                # Static brand assets and SVG icon sprite
├── src/
│   ├── app/               # Pages, layouts, auth callback, API handlers
│   ├── components/        # Chat, layout, and reusable UI components
│   ├── hooks/             # Client hooks, including preferences
│   ├── lib/               # Shared utilities, Supabase clients, AI/RAG helpers
│   ├── providers/         # React context providers
│   └── styles/            # Global CSS and theme tokens
├── supabase/
│   ├── migrations/        # Ordered SQL migrations
│   └── schema.sql         # Reference schema snapshot
├── tests/                 # Repository architecture verification
├── types/                 # Shared TypeScript contracts
├── middleware.ts          # Session refresh and route gating
└── package.json           # Dependencies and scripts
```

For the detailed route inventory, file responsibilities, dependency direction, and safe future refactoring rules, see [Project structure](docs/architecture/project-structure.md).

## Environment variables

The app uses the same canonical variable names configured in Vercel:

- **Public Supabase configuration:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- **Server-only Supabase credential:** `SUPABASE_SECRET_KEY`
- **Groq:** `GROQ_API_KEY`, `GROQ_FAST_MODEL`, `GROQ_PRO_MODEL`, optional `GROQ_VISION_MODEL` (defaults to `qwen/qwen3.6-27b` for image fallback)
- **Gemini:** `GEMINI_API_KEY`, `GEMINI_MODEL`
- **Web research:** `TAVILY_API_KEY`

Only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are exposed to the browser by `next.config.ts`; these are public Supabase configuration values. Never expose `SUPABASE_SECRET_KEY` or provider API keys to client code.

## Working safely in this repository

- Preserve Supabase Auth, Google OAuth callback handling, row-level security (RLS), and existing data contracts unless a reviewed change explicitly requires otherwise.
- Keep page and component code separate from API route handlers and server-only credentials.
- Add database changes as new migrations; do not rewrite migrations that may already have been applied to shared environments.
- Move files only after checking imports, runtime boundaries, and tests. Prefer small changes that can be verified independently.
- Treat a successful build as one quality signal—not proof of live OAuth, database, provider, or deployment health.
