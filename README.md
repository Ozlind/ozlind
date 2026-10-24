# Ozlind

Ozlind is a mobile-first AI chat application built with Next.js App Router, React, TypeScript, the Vercel AI SDK, and Supabase. This repository contains the application UI, server route handlers, authentication integration, database migrations, and repository verification checks.

## Requirements

- Node.js 20.9 or later, below 25 (see `.nvmrc` and `package.json`)
- npm
- A Supabase project
- At least one configured AI provider: Groq or Google Generative AI. Vercel AI Gateway is optional and can provide additional models/providers.

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

## AI provider routing

Ozlind supports Groq and Google Generative AI directly. An optional Vercel AI Gateway integration can add models from OpenAI, Anthropic, Google, and other supported providers without adding a separate SDK for every vendor. Configure these server-only Vercel environment variables to enable it:

- `AI_GATEWAY_API_KEY`: Vercel AI Gateway API key.
- `AI_GATEWAY_FAST_MODEL`: gateway model ID for the Fast fallback.
- `AI_GATEWAY_PRO_MODEL`: gateway model ID for the Pro/reasoning fallback.
- `AI_GATEWAY_AUTO_MODEL`: gateway model ID for the Auto/Gemini fallback slot.
- `AI_GATEWAY_VISION_MODEL`: a gateway model ID that supports image input.
- `AI_GATEWAY_FALLBACK_MODELS`: optional comma-separated list of up to eight additional gateway model IDs tried after the primary configured candidates. Use exact IDs shown in your Gateway model catalog.

Gateway model IDs are explicit and optional; Ozlind will not guess a model or route image requests to a text-only model. Native Groq/Google models remain first in the fallback chain, followed by explicitly configured Gateway models and then the optional fallback list. On Vercel, the SDK can use the platform Gateway runtime without a separately supplied Gateway key; outside Vercel, set `AI_GATEWAY_API_KEY`. Keep all credentials server-side. Check model availability, supported modalities, pricing, and account access before enabling a model. Provider availability is not the same as free usage: each provider/model has its own quota and pricing.

PostHog collection is temporarily paused by default. Keep `NEXT_PUBLIC_OZLIND_ANALYTICS_ENABLED=false` (or unset) to leave it paused; enabling collection requires explicitly setting it to `true` and redeploying.

## Chat reliability

- Assistant text streams in-place; retrying or regenerating a response replaces the current answer for the latest user turn rather than creating a duplicate assistant bubble.
- Interrupted responses keep any text already received and offer a retry action. Retry controls are disabled while a request is active or the browser is offline.
- Image payloads are routed through configured vision-capable models; local image previews are stored in browser IndexedDB, not synced across devices.

## Voice interactions

- The chat composer includes browser-supported speech-to-text dictation. In **Voice** mode, a recognized utterance is submitted automatically and the completed answer is read aloud; without Voice mode, dictation fills the draft for review before sending.
- Assistant messages also have an on-demand **Read aloud** control. Speech playback uses the browser's native speech synthesis; speech recognition depends on browser support and microphone permission, and uses the browser's configured language/locale.
- No speech provider SDK or API key is required. Speech audio is not uploaded to an Ozlind speech endpoint; however, the browser's speech-recognition implementation may process audio through its own service. Use regular text input if voice recognition is unavailable or not appropriate for your privacy needs.
- Voice recognition is turn-based: tap the microphone for each utterance. It does not continuously record in the background.

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
- **Groq:** `GROQ_API_KEY`; `GROQ_FAST_MODEL` defaults to `openai/gpt-oss-20b`, `GROQ_PRO_MODEL` to `openai/gpt-oss-120b`, and optional `GROQ_VISION_MODEL` to `qwen/qwen3.8-27b`. Model IDs are configurable without code changes.
- **Gemini:** `GEMINI_API_KEY`, `GEMINI_MODEL`
- **Web research:** `TAVILY_API_KEY`

Only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are exposed to the browser by `next.config.ts`; these are public Supabase configuration values. Never expose `SUPABASE_SECRET_KEY` or provider API keys to client code.

## Working safely in this repository

- Preserve Supabase Auth, Google OAuth callback handling, row-level security (RLS), and existing data contracts unless a reviewed change explicitly requires otherwise.
- Keep page and component code separate from API route handlers and server-only credentials.
- Add database changes as new migrations; do not rewrite migrations that may already have been applied to shared environments.
- Move files only after checking imports, runtime boundaries, and tests. Prefer small changes that can be verified independently.
- Treat a successful build as one quality signal—not proof of live OAuth, database, provider, or deployment health.
