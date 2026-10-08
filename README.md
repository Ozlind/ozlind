# Ozlind — Stage 1

Stage 1 establishes the production chat foundation: Next.js 15 App Router, TypeScript, Vercel AI SDK v4, Supabase SSR/Auth/RLS, responsive chat UI, persistent messages, streaming, stop/interruption handling, regeneration, model selection, Markdown/GFM, and offline state.

## Setup

1. Use Node.js 20.9+.
2. Copy `.env.example` to `.env.local` and set the two public Supabase variables plus Groq and Gemini keys.
3. Run `supabase/migrations/20261008_stage1_core.sql` in the Supabase SQL editor.
4. Enable Email/Password and Google providers in Supabase Auth.
5. Add `/auth/callback` to the Supabase redirect URLs.
6. Run `npm install`, then `npm run dev`.

## Verification

Run `npm run typecheck`, `npm run lint`, and `npm run build`.

The chat persistence contract is: user row first, assistant row with `streaming`, partial content flushed during generation, `complete` on success, and `interrupted` on stream failure. Schedule `public.interrupt_stale_messages()` from a trusted database scheduler for 60-second cleanup.
