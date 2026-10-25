# Ozlind Repository Structure

**Status:** Current repository map and incremental refactoring guide  
**Stack:** Next.js App Router, React, TypeScript, Vercel AI SDK, Supabase, Vercel

This document describes the files that currently exist in the repository. Proposed future layers are explicitly marked as future work; a folder diagram must not be mistaken for implemented functionality.

## Current repository tree

```text
ozlind/
├── .github/workflows/ci.yml
├── docs/
│   ├── adr/                      # Accepted design decisions
│   ├── engineering/               # Engineering standards and navigation
│   ├── product/product-charter.md
│   ├── roadmap/implementation-roadmap.md
│   ├── architecture/target-architecture.md
│   ├── architecture/ai-runtime-contract.md
│   ├── architecture/project-structure.md
│   ├── operations/environment-and-secrets.md
│   ├── testing/verification-matrix.md
│   ├── workflows/                # Delivery, release, incident runbooks
│   ├── audits/                   # Dated repository/security reviews
│   ├── internal/                 # Internal operations/security runbooks
│   └── legal/                    # Draft policies; not published routes
├── public/
│   ├── ozlind-icons.svg
│   └── ozlind-mark.svg
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── artifacts/route.ts
│   │   │   ├── chat/route.ts
│   │   │   ├── documents/route.ts
│   │   │   ├── health/route.ts
│   │   │   ├── preferences/route.ts
│   │   │   ├── presets/route.ts
│   │   │   ├── ready/route.ts
│   │   │   └── research/route.ts
│   │   ├── app/
│   │   │   ├── [conversationId]/page.tsx
│   │   │   ├── documents/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   ├── workspace/page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── auth/callback/route.ts
│   │   ├── login/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── chat/             # Chat, Markdown renderer, offline status
│   │   ├── layout/           # App shell and sidebar
│   │   └── ui/               # Button, input, Ozlind SVG icon wrapper
│   ├── hooks/usePreferences.ts
│   ├── lib/
│   │   ├── chat/streaming.mjs + streaming.d.mts # Tested stream UI batching policy
│   │   ├── documents/        # Document ingestion, embeddings, and retrieval
│   │   │   ├── embeddings.js + embeddings.d.ts
│   │   │   └── rag.js + rag.d.ts
│   │   ├── security/request.mjs + request.d.mts # Bounded request JSON parsing
│   │   ├── supabase/         # Browser, server, and middleware clients
│   │   ├── i18n.ts
│   │   └── rate-limit.ts
│   ├── providers/QueryProvider.tsx
│   └── styles/
│       ├── globals.css
│       └── theme.css
├── supabase/
│   ├── migrations/            # Ordered SQL changes
│   └── schema.sql             # Reference schema snapshot
├── tests/
│   ├── chat-streaming.test.mjs
│   ├── security.test.mjs
│   └── verify.mjs
├── package-lock.json         # Deterministic npm dependency tree
├── types/chat.ts
├── middleware.ts
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── .env.example
```

## File ownership

| Location | Responsibility | Keep out of this location |
| --- | --- | --- |
| `src/app/**/page.tsx` | Route composition and page-level UI | Reusable primitives, database credentials |
| `src/app/api/**/route.ts` | HTTP boundary, request validation, auth checks, status/stream mapping | Large reusable UI, unrelated business logic |
| `src/app/auth/callback/route.ts` and `src/lib/supabase/*` | Supabase session and auth integration | Client-side secrets or duplicated auth flows |
| `src/components/ui/` | Small reusable accessible UI primitives | Feature-specific data fetching |
| `src/components/layout/` | App shell, navigation, responsive drawer | AI provider orchestration |
| `src/components/chat/` | Chat presentation and message interaction | Supabase service-role access |
| `src/hooks/` | Client-side reusable state and behavior | Server-only SDKs and secrets |
| `src/providers/` | React context/provider setup | Route-specific page layout |
| `src/lib/supabase/` | Browser/server/middleware Supabase client factories | UI components |
| `src/lib/` | Rate limiting, i18n, bounded request parsing, tested stream policy, Supabase clients and RAG helpers | UI components or duplicate helpers |
| `src/styles/` | Global styling, semantic theme tokens, responsive states | Application data logic |
| `types/` | Shared TypeScript contracts | Runtime implementations |
| `supabase/migrations/` | Append-only database changes | Application UI or provider code |
| `tests/` | Automated repository checks | Production runtime code |
| `docs/adr/` | Decisions and trade-offs | Claims that are not yet implemented |

## API route inventory

- `/api/chat` — chat request validation, model/provider streaming, persistence and interruption handling.
- `/api/documents` — document library operations.
- `/api/preferences` — user preference persistence.
- `/api/research` — research request handling.
- `/api/presets` and `/api/artifacts` — workspace presets and saved artifacts.
- `/api/health` and `/api/ready` — health/readiness responses; readiness currently checks required environment configuration, not a full end-to-end provider/database transaction.

Keep route-specific behavior at the HTTP boundary and extract shared behavior only when the existing contract is understood and covered by verification. Do not describe an API as versioned under `/api/v1` unless those routes are actually implemented.

## Dependency and security rules

1. **UI components** may depend on shared UI utilities and client-safe hooks. They must not import server-only secrets or service-role clients.
2. **Route handlers** authenticate and authorize the request, validate untrusted input, call the required server integrations, and map results to HTTP or streaming responses.
3. **Supabase access** must respect row-level security and resource ownership. A valid session alone does not grant access to every row.
4. **Provider keys** stay server-side. Never prefix a secret with `NEXT_PUBLIC_`.
5. **Database changes** are new ordered migrations. Check applied migration history before applying SQL to a shared database.
6. **RAG and embeddings** are grouped under `src/lib/documents/` with adjacent TypeScript declaration files. Keep document-specific indexing and retrieval code together; test runtime/module compatibility when changing these helpers.
7. **Middleware** should remain small and focused on session refresh and route gating; avoid duplicating authorization logic that belongs at the API/data boundary.

## Safe organization strategy

The repository currently uses a compact structure rather than the full Clean Architecture layering described in some design proposals. Do not create empty `features/`, `server/`, `repositories/`, or `domain/` directories just to make the tree look more sophisticated.

Use this order for future code organization:

1. Inventory imports and identify duplicate or unused implementations.
2. Add or update tests before moving behavior.
3. Move one cohesive module at a time, updating every import in the same change.
4. Preserve public routes, request/response shapes, Supabase Auth, Google OAuth, RLS policies, database schema, and persisted user data.
5. Run `npm run verify` and review the deployment created from the exact commit.
6. Keep executable `.mjs` helpers paired with `.d.mts` declarations when TypeScript imports them; run Node tests and `tsc` after changes.
7. Remove an old file only after confirming it has no live imports, runtime references, or migration dependency.

## Verification and known limitations

The repository check is `npm run verify`, which runs request-boundary security tests, chat-streaming policy tests, TypeScript validation, ESLint, architecture checks and a production build. CI installs from the committed lockfile with `npm ci` and blocks on `npm audit --omit=dev --audit-level=high`. The full audit still reports development-toolchain issues in the existing Tailwind CSS 3 / Next.js lint dependency graph; compatible fixes require a coordinated toolchain-major migration and are tracked in the dated security follow-up.

A passing repository build does not prove that production Supabase credentials, Google OAuth redirect configuration, AI provider quotas, runtime logs, or live deployed flows are healthy. Those require separate environment/deployment checks.
