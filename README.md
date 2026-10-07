# OZLIND AI

Production rebuild of the OZLIND AI chat platform.

## Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres/Auth/Storage/RLS
- Vercel
- Server-side AI providers

## Development
Requires Node.js 20+.

```bash
npm install
npm run lint
npm run typecheck
npm run verify
npm run build
npm run dev
```

Copy `.env.example` to `.env.local` and provide local development variables.

Provider keys and Supabase secret credentials are server-only. Never prefix them with `NEXT_PUBLIC_` and never commit them.

See [PLAN.md](./PLAN.md) for the rebuild architecture and milestone sequence.
