# OZLIND AI

A real, secure, production-ready AI workspace created and owned by Athul.

## Architecture

- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS
- **Backend**: Vercel serverless API routes
- **Database**: Supabase (Postgres)
- **Auth**: Supabase Auth (email + Google OAuth)
- **Storage**: Supabase Storage (private uploads bucket)
- **AI Providers**: Groq (fast), Gemini (complex/vision), Tavily (research)

## Environment Variables

Server-only (never expose to client):
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_TEXT_MODEL`
- `GEMINI_IMAGE_MODEL`
- `TAVILY_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Public:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Local Development

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run build
npm run verify
```

## Security

- RLS policies on all tables
- Rate limiting per user (100/day)
- File upload validation (magic bytes, size, type)
- Input length limits
- No secrets in client bundle
- CSP and security headers

## Roadmap

- [x] Chat with SSE streaming
- [x] Multi-provider routing (Groq/Gemini)
- [x] Research mode with Tavily
- [x] File uploads
- [x] Conversation history
- [x] Memory system
- [x] Settings (mode, style, theme)
- [ ] Image generation
- [ ] Photo Editor
- [ ] Code Assistant
- [ ] Voice
- [ ] Documents

## Features marked Coming Soon

- Image generation
- Photo Editor
- Code Assistant
- Voice
- Documents
