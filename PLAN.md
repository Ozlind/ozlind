# OZLIND AI — Rebuild Plan

## Milestone 0 — Repository Audit and Rebuild Plan

Date: 2026-10-07
Target branch: `rebuild`
Production branch: `main` (read-only until the final pull request)

## 1. What exists today

The current repository is a partially production-hardened OZLIND application, not a blank starter.

Observed top-level structure:

```
.env.example
.github/workflows/ci.yml
.gitignore
.nvmrc
README.md
app/
  api/
  auth/
  documents/
  error.jsx
  global-error.jsx
  globals.css
  layout.jsx
  loading.jsx
  login/
  not-found.jsx
  page.jsx
  premium.css
  tokens.css
components/
  DocumentLibrary.jsx
  DocumentLibrary.module.css
  MarkdownRenderer.jsx
  OzlindApp.jsx
constants/
lib/
  agent.js
  cloud.js
  embeddings.js
  providers.js
  rag.js
  rate-limit.ts
  server.js
  supabase/
middleware.js
next.config.ts
package.json
public/
supabase/
  migrations/
  schema.sql
tests/
  verify.mjs
tsconfig.json
types/
  chat.ts
```

Important existing capabilities found during inspection:

- Next.js App Router and React 19.
- Supabase SSR/client integration and authentication routes.
- Conversations/messages/user settings/document storage schema with RLS.
- Streaming chat API with provider routing and request cancellation logic.
- Groq/Gemini provider abstraction and Tavily web research.
- RAG/document search infrastructure using pgvector.
- Rate-limit infrastructure.
- Markdown rendering and a substantial chat UI.
- Error/loading/not-found boundaries.
- Security headers/CSP in `next.config.ts`.
- CI and a repository verification script.
- Existing mobile/responsive styling and accessibility checks.

## 2. Why a rebuild is still required

The current implementation mixes JavaScript/JSX and TypeScript, contains a very large monolithic client component, and has accumulated several generations of architecture and UI.

Examples observed:

- `components/OzlindApp.jsx` is over 100 KB and owns too many responsibilities.
- `app/api/chat/route.js`, `lib/server.js`, and `lib/providers.js` are JavaScript rather than the required TypeScript architecture.
- Styling is split across large CSS files rather than a clean Tailwind component system.
- Existing Supabase schema/migrations need to be consolidated into a clean migration history for the new data model.
- The existing feature surface is broader than the desired core architecture, increasing coupling and regression risk.
- The chat API contains usage logging calls whose helper is not currently defined/imported, so runtime stability must be revalidated rather than assumed.
- The existing verification script is useful but is tied to the legacy structure and must be replaced/expanded for the rebuild.

We will preserve useful product behavior conceptually, but not preserve legacy implementation boundaries when they conflict with the new architecture.

## 3. Rebuild assumptions

These assumptions are intentional and will be changed only if implementation evidence requires it:

1. `main` remains untouched throughout the rebuild.
2. All implementation work happens on `rebuild`.
3. One commit is created per milestone.
4. The final deliverable is an open pull request from `rebuild` to `main`; it will not be merged.
5. Next.js App Router + TypeScript + Tailwind CSS is the canonical frontend stack.
6. Supabase is the canonical database, authentication, storage, RLS, and PostgreSQL platform.
7. AI provider keys are server-only Vercel environment variables.
8. Groq is the primary low-cost/free provider. OpenRouter is supported as a configurable fallback where a free model is available.
9. DeepThink uses a configured reasoning-capable model and is exposed as an explicit user mode, not as hidden model behavior.
10. Web Search is performed server-side and citations are treated as untrusted retrieved evidence, not executable instructions.
11. Guest chat is intentionally limited and is not allowed to write authenticated conversation history.
12. Authenticated conversations are persisted in Supabase and protected by ownership RLS.
13. Uploaded files are stored in Supabase Storage; metadata is stored in Postgres.
14. All database tables created by the rebuild have RLS enabled and explicit policies.
15. All SQL changes are numbered migrations under `supabase/migrations/`; `schema.sql` will become documentation/generated reference rather than the source of migration truth.
16. The app will support English, Malayalam, and Manglish UI/response preferences.
17. Theme supports dark, light, and system.
18. Mobile is the primary constrained viewport; desktop receives the expanded workspace/sidebar experience.
19. The rebuild favors small composable components over a single application component.
20. No API secret, service-role credential, or provider key will ever be shipped to the browser.

## 4. Target architecture

### Application layers

- Presentation: Tailwind + small accessible React/TSX components.
- App routing: Next.js App Router.
- Client state: local React state/context only where appropriate; server state remains server-owned.
- Server actions/API: authenticated, validated, typed boundaries.
- AI orchestration: provider-neutral server layer with routing, retries, abort handling, streaming, and usage accounting.
- Search: server-side retrieval pipeline with source normalization and citation metadata.
- Persistence: Supabase Postgres + RLS.
- Files: Supabase Storage + signed access where needed.
- Authentication: Supabase Auth with email/password and Google OAuth.
- Hosting: Vercel.
- Observability: structured server logging and production-safe error reporting.

### Target folder tree

```
app/
  (auth)/
    login/
    auth/callback/
  (chat)/
    chat/
    settings/
  api/
    chat/
    conversations/
    messages/
    search/
    uploads/
    share/
    feedback/
    account/
  privacy/
  terms/
  layout.tsx
  page.tsx
  not-found.tsx
  error.tsx
  global-error.tsx
  loading.tsx
  manifest.ts
  robots.ts
  sitemap.ts

components/
  chat/
    chat-shell.tsx
    message-list.tsx
    message-item.tsx
    composer.tsx
    thinking-panel.tsx
    source-citations.tsx
    attachment-preview.tsx
    code-block.tsx
  sidebar/
    sidebar.tsx
    conversation-list.tsx
    conversation-item.tsx
  settings/
  auth/
  ui/

lib/
  ai/
    providers.ts
    router.ts
    prompts.ts
    stream.ts
    safety.ts
  auth/
  db/
  search/
  storage/
  validation/
  rate-limit/
  utils/

hooks/
  use-chat.ts
  use-theme.ts
  use-shortcuts.ts
  use-mobile.ts

types/
  chat.ts
  database.ts
  api.ts

constants/
  models.ts
  limits.ts
  i18n.ts

supabase/
  migrations/
  seed/

public/
  icons/
  screenshots/

tests/
  unit/
  integration/
  verify.mjs
```

The exact final tree may be simplified where a separate file provides no architectural value.

## 5. Milestone sequence

### 0 — Inspect + PLAN
Deliverable: this file on `rebuild`.

### 1 — Foundation
- Convert application source to TypeScript/TSX.
- Establish Tailwind architecture and design tokens.
- Establish strict TypeScript settings.
- Add typed environment validation.
- Establish clean scripts and test/build gates.
- Remove legacy structural duplication.

### 2 — Supabase data layer
Create numbered migrations for:
- profiles
- conversations
- messages
- attachments
- feedback
- shared_chats
- memory/context summaries
- required indexes/triggers
- Storage buckets and Storage RLS policies

Every table gets RLS and ownership policies.

### 3 — Auth
- Supabase email auth.
- Google OAuth.
- Session refresh.
- Protected routes.
- Guest mode with server-enforced limits.
- Profile bootstrap.

### 4 — Chat API
- Zod request validation.
- Server-only provider access.
- Provider routing.
- DeepThink model path.
- SSE streaming.
- Abort/stop support.
- Rate limiting.
- Safe errors.
- Prompt-injection boundary.
- Usage accounting.
- Retry/fallback policy.

### 5 — Chat UI
- Responsive DeepSeek-style workspace.
- Composer and attachments.
- Streaming rendering.
- Stop/regenerate/edit/resend.
- Copy/like/dislike.
- Markdown/tables.
- Syntax-highlighted code with copy.
- KaTeX.
- Collapsible DeepThink section.
- Search citations.
- Typing/skeleton/error states.

### 6 — History + memory
- Date-grouped sidebar.
- Search.
- Rename/pin/delete.
- Auto titles.
- Share links.
- Recent-message context.
- Rolling conversation summary.
- Clear-data controls.
- RLS-backed persistence.

### 7 — Search + uploads
- Search toggle and citation pipeline.
- Image upload/preview.
- File upload/preview.
- Storage policies.
- Size/type validation.
- Safe extraction and context limits.

### 8 — UX polish
- Dark/light/system.
- English/Malayalam/Manglish.
- Keyboard shortcuts.
- Accessibility.
- Empty states.
- Skeletons.
- Mobile safe areas.
- Focus management.
- Motion kept subtle and performant.

### 9 — Production hardening
- Security headers/CSP.
- CORS policy where required.
- Input/output limits.
- Abuse/rate limiting.
- Error boundaries.
- Structured logging.
- Cache strategy.
- Code splitting.
- Performance review.
- SEO/OG.
- PWA.
- Privacy/Terms.
- 404/500.
- Lighthouse/performance pass.

### 10 — Launch package
- Final README.
- Architecture documentation.
- Test checklist.
- Vercel environment-variable checklist.
- Supabase migration/setup instructions.
- Production verification.
- Final branch status.
- Open `rebuild -> main` PR.
- Do not merge.

## 6. Commit policy

Each milestone receives exactly one intentional commit after its implementation and verification gate passes.

Commit naming convention:

- `docs: add rebuild plan`
- `feat: establish typed foundation`
- `feat: rebuild supabase data layer`
- `feat: add authentication`
- `feat: rebuild streaming chat api`
- `feat: rebuild chat workspace`
- `feat: add history and memory`
- `feat: add search and uploads`
- `feat: polish chat experience`
- `chore: harden production`
- `docs: prepare production launch`

No secrets or generated local environment files will be committed.

## 7. Verification gate

Before every milestone commit:

1. Install/resolve dependencies.
2. Run lint.
3. Run TypeScript typecheck.
4. Run production build.
5. Run repository verification/tests.
6. Fix all errors before committing.
7. After the commit, verify the Vercel preview and report exact user actions only when required.

If a required check cannot be executed through the available repository/CI environment, it will be reported explicitly rather than falsely marked as passed.

## 8. User-only actions

The rebuild should stop only when an action genuinely requires the user's account access, such as:

- Creating/configuring a Supabase project.
- Adding Vercel environment variables.
- Completing Google OAuth provider configuration.
- Approving an external provider's account/consent flow.

When needed, instructions will be phone-friendly and click-by-click, then implementation will continue.

## 9. Definition of done

The rebuild is complete when:

- `rebuild` contains the complete production implementation.
- `main` has not been modified by this rebuild.
- All milestones have one commit each.
- Production checks pass.
- Auth, chat, history, memory, search, uploads, sharing, feedback, and settings work end-to-end.
- RLS protects every database table and storage object.
- No secrets are committed.
- The Vercel preview is usable on mobile and desktop.
- Lighthouse/performance/security targets have been reviewed.
- README and operational setup instructions are complete.
- A non-merged pull request from `rebuild` to `main` is open.
