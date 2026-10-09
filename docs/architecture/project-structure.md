# Ozlind Project Structure

**Status:** Architecture baseline for incremental implementation  
**Stack:** Next.js App Router, TypeScript, React, Vercel AI SDK, Supabase, Vercel

This document defines the intended ownership boundaries for Ozlind. It is a migration target, not a claim that every directory or module already exists. Keep the current application working and move code in small, tested steps; do not create duplicate implementations just to match a diagram.

## Repository layout

\`\`\`text
ozlind/
├── .github/
│   └── workflows/              # CI and repository automation
├── docs/
│   ├── adr/                    # Architecture decision records
│   └── architecture/
│       └── project-structure.md
├── public/                     # Static, non-secret assets
├── src/
│   ├── app/                    # Next.js routes, layouts, route handlers
│   │   ├── (marketing)/         # Public pages, if/when separated
│   │   ├── app/                 # Authenticated product routes
│   │   ├── api/                 # Thin HTTP adapters only
│   │   └── auth/                # Authentication callback routes
│   ├── components/
│   │   ├── ui/                  # Accessible, reusable primitives
│   │   ├── layout/              # App shell, navigation, responsive sidebar
│   │   └── chat/                # Chat presentation components
│   ├── features/                # Feature-owned UI, schemas, hooks and contracts
│   │   ├── chat/
│   │   ├── conversations/
│   │   ├── documents/
│   │   ├── research/
│   │   ├── preferences/
│   │   └── workspace/
│   ├── server/                  # Server-only application and domain code
│   │   ├── application/         # Use cases/orchestration
│   │   ├── domain/              # Business rules and domain types
│   │   ├── repositories/        # Persistence interfaces and implementations
│   │   ├── providers/           # LLM provider adapters and model routing
│   │   ├── security/            # Authz, validation, quotas and safe redirects
│   │   └── observability/       # Structured logs, tracing and error mapping
│   ├── lib/                     # Small shared utilities and SDK clients
│   │   └── supabase/            # Browser/server/middleware Supabase clients
│   ├── providers/               # React context providers
│   ├── stores/                  # Client state only; no server secrets
│   ├── styles/                  # Global styles and design tokens
│   └── types/                   # Shared transport/UI types where appropriate
├── supabase/
│   ├── migrations/              # Ordered, reviewable database changes
│   └── schema.sql               # Reference schema snapshot
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── verify.mjs
├── .env.example                 # Names/placeholders only; never secrets
├── middleware.ts                # Request/session middleware, minimal logic
├── next.config.ts
├── package.json
└── tsconfig.json
\`\`\`

## Layer ownership and dependency direction

1. **Route handlers (src/app/api/**/route.ts)** — parse HTTP input, authenticate the request, call an application use case, and map the result to HTTP/stream responses. Keep business rules out of route handlers.
2. **Application (src/server/application)** — coordinates a use case such as sending a message, creating a conversation, indexing a document, or running research. It owns workflow sequencing, not UI details.
3. **Domain (src/server/domain)** — business invariants, domain errors and provider-independent types. It must not import Next.js, React, Supabase SDKs, or provider SDKs.
4. **Repositories (src/server/repositories)** — persistence contracts and Supabase-backed implementations. Enforce user/tenant ownership in the database as well as at the application boundary.
5. **Provider adapters (src/server/providers)** — LLM/model selection, streaming adapters, embeddings and retrieval integrations. Provider-specific details must not leak into domain types.
6. **UI (src/features, src/components)** — rendering, user interaction, optimistic state and accessible responsive behavior. Never import server-only modules or secrets.
7. **Shared infrastructure (src/lib)** — narrowly scoped utilities and SDK clients. Avoid turning this into a miscellaneous business-logic directory.

Dependency direction: **HTTP/UI → application → domain contracts**. Infrastructure adapters implement contracts at the edge. Keep server-only modules out of client bundles; use import "server-only" for modules that must never run in the browser.

## Feature boundaries

- **Chat:** request validation, model choice, streaming lifecycle, cancellation, regeneration, message persistence and failure recovery.
- **Conversations:** list, create, rename, archive/delete, ownership checks and pagination.
- **Documents / RAG:** upload validation, storage metadata, extraction, chunking, embeddings, retrieval and citations.
- **Research:** task orchestration, source collection, timeouts, partial results and clear provenance.
- **Preferences:** validated user settings with safe defaults and server-side authorization.
- **Workspace:** workspace membership and resource ownership; do not rely only on client-side checks.

A feature may initially remain in the current src/app, src/lib, and src/components locations. Move it only when there is a clear boundary and tests cover the behavior.

## Security and reliability rules

- Validate every untrusted payload at the server boundary (Zod or an equivalent schema).
- Authenticate with the server-side Supabase client and authorize each resource against its owner/workspace. A valid session alone is not authorization.
- Keep Row Level Security enabled for user data. Review every new table, policy, function and storage bucket in a migration.
- Never expose service-role keys, provider keys, raw stack traces or sensitive prompts to the browser/logs.
- Accept only safe same-origin relative paths for post-auth redirects; reject protocol-relative paths such as //example.com.
- Apply rate limits and request-size/time limits to expensive routes. A process-local limiter is not sufficient for multi-instance production.
- Make streamed writes resilient to cancellation, provider errors, client disconnects and retries; avoid duplicate persisted messages.
- Use structured logs with request/correlation IDs and redact tokens, cookies, message content and personal data by default.
- Health checks should distinguish process liveness from dependency readiness and should not reveal secrets/configuration.
- Database changes are append-only migrations; do not edit a migration that may already have run in a shared environment.

## Testing and release gates

- **Unit:** domain rules, schemas, redirect validation, model routing, quota calculations and error mapping.
- **Integration:** repository ownership, RLS behavior, persistence lifecycle, storage and provider adapter contracts.
- **End-to-end:** sign-in/callback, send/stop/regenerate chat, reload persisted conversation, document workflow and mobile navigation.
- **CI required checks:** typecheck, lint, architecture guard, tests and production build. Security/dependency checks should report actionable failures; do not silently treat them as passed.
- **Release:** review migration order, environment variables, provider quotas, logs/alerts, rollback path and actual Vercel deployment health.

## Incremental implementation order

1. Fix and test security findings in existing routes before broad refactors.
2. Add domain/application contracts around the existing chat flow without changing its public API.
3. Move chat persistence behind repository functions and test ownership/RLS.
4. Apply the same pattern to documents, preferences, research and workspace one feature at a time.
5. Add integration/E2E coverage and strengthen CI before declaring production readiness.

## Done means

A folder existing is not completion. A boundary is complete only when its behavior is covered by tests, authorization is enforced server-side and in RLS where applicable, errors are observable without leaking secrets, and the production build and deployed smoke tests pass.
