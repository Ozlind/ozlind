# Ozlind Repository Structure

**Status:** Verified repository map for `main` (2026-11-12)
**Stack:** Next.js 15 App Router, React 19, TypeScript, Vercel AI SDK, Supabase, Vercel

This guide reflects the tracked repository paths. It is an orientation map, not a list of files that should be deleted. Remove a module only after checking imports, route references, runtime behavior, tests, and database dependencies.

## Current structure

```text
ozlind/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── dependabot.yml
│   ├── pull_request_template.md
│   └── workflows/
│       ├── ci.yml
│       └── dependency-security.yml
├── docs/
│   ├── adr/
│   ├── architecture/
│   ├── audits/
│   ├── engineering/
│   ├── internal/
│   ├── legal/
│   ├── operations/
│   ├── product/
│   ├── roadmap/
│   ├── testing/
│   └── workflows/
├── public/
│   └── ozlind-icons.svg
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
│   │   │   ├── [conversationId]/
│   │   │   ├── documents/
│   │   │   ├── settings/
│   │   │   ├── workspace/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── auth/callback/route.ts
│   │   ├── login/
│   │   ├── icon.svg
│   │   ├── layout.tsx
│   │   ├── not-found.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── analytics/
│   │   ├── chat/
│   │   ├── layout/
│   │   └── ui/
│   ├── hooks/usePreferences.ts
│   ├── lib/
│   │   ├── ai/
│   │   ├── chat/
│   │   ├── documents/
│   │   ├── research/
│   │   ├── security/
│   │   ├── supabase/
│   │   ├── analytics.ts
│   │   ├── i18n.ts
│   │   └── rate-limit.ts
│   ├── providers/QueryProvider.tsx
│   └── styles/
│       ├── globals.css
│       ├── sidebar-polish.css
│       ├── theme.css
│       └── unified-design-system.css
├── supabase/
│   ├── migrations/             # Ordered, append-only SQL migrations
│   └── schema.sql              # Reference schema snapshot
├── tests/                      # Unit, regression, security and architecture checks
├── types/chat.ts
├── middleware.ts
├── package.json
├── package-lock.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── .env.example
├── .nvmrc
└── README.md
```

## Runtime boundaries

| Area | Responsibility |
| --- | --- |
| `src/app/**/page.tsx` | Route composition and page-level UI |
| `src/app/api/**/route.ts` | HTTP validation, authentication, authorization, rate limits and response mapping |
| `src/app/auth/callback/route.ts` | Supabase OAuth code exchange and same-origin redirect validation |
| `src/components/chat/` | Chat presentation, streaming UI, message actions and offline state |
| `src/components/layout/` | Authenticated shell, navigation, sidebar and command palette |
| `src/components/analytics/` | Privacy-aware PostHog integration |
| `src/lib/ai/` | Model/reasoning and preset context helpers |
| `src/lib/chat/` | Message state, streaming policy, image persistence and export helpers |
| `src/lib/documents/` | Document ingestion, embeddings and retrieval |
| `src/lib/security/` | Bounded request parsing and request-boundary protections |
| `src/lib/supabase/` | Browser, server and middleware Supabase clients |
| `src/styles/` | Global layout, theme tokens and shared component styling |
| `supabase/migrations/` | Ordered database changes; never delete or reorder as cosmetic cleanup |
| `tests/` | Regression, security, quality, service and architecture verification |

## Current API surface

- `POST /api/chat` — authenticated AI model routing, streaming, persistence and interruption handling.
- `GET|POST|DELETE /api/documents` — authenticated document library operations and retrieval.
- `POST /api/research` — authenticated provider-backed web research.
- `GET|POST|PATCH|DELETE /api/preferences` — user preference persistence.
- `GET|POST|PATCH|DELETE /api/presets` — user prompt presets.
- `GET|POST|PATCH|DELETE /api/artifacts` — saved workspace artifacts.
- `GET /api/health` and `GET /api/ready` — operational health/readiness checks. Readiness checks configuration presence; it is not a full authenticated provider/database transaction.

## Verification

The canonical repository check is `npm run verify`. It runs the tracked security, dependency, chat-streaming, AI-response-quality, export, preset, analytics, service-status, voice-selection and productivity tests, followed by TypeScript, ESLint, architecture verification and a production build.

CI installs from `package-lock.json` using `npm ci`. The separate dependency-audit workflow checks production dependencies. A green build or deployment is not proof that every authenticated user journey works.

## Safe cleanup rules

1. Preserve AI chat, Vision/image attachments, Web Search/Research, voice input/output, chat history, Google OAuth, Supabase persistence, preferences, documents, presets and artifacts.
2. Do not remove tests, SQL migrations, security controls, error handling or diagnostics merely to reduce the file count.
3. Before deleting a file, search static imports, dynamic imports, route references, CSS selectors, test references and configuration references.
4. Treat SQL migrations as append-only. Reconcile the live migration ledger before any database operation; never run cleanup SQL against Production as a shortcut.
5. Refactor large shared styles incrementally and verify mobile, desktop, light and dark themes after each change.
6. Make cleanup changes on a dedicated branch, run `npm run verify`, inspect the complete diff, and deploy only after the exact candidate passes its release checks.
