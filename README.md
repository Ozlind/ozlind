# OZLIND AI — Next.js New Interface

This rebuild replaces the old OZLIND frontend with the supplied new `index.html` interface, converted to React/Next.js.

## Structure

- `app/page.jsx` — page entry
- `app/layout.jsx` — metadata and document shell
- `app/globals.css` — supplied new interface CSS
- `components/OzlindApp.jsx` — new interface and client interactions
- `app/api/chat/route.js` — real streaming AI endpoint
- `app/api/research/route.js` — Tavily research endpoint
- `lib/providers.js` — server-side provider routing
- `lib/server.js` — request validation and prompt utilities

## Environment variables

Set the variables in `.env.local` locally or Vercel Environment Variables:

- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_TEXT_MODEL`
- `EXPERIENTIAL_API_KEY`
- `EXPERIENTIAL_MODEL`
- `TAVILY_API_KEY`

Never expose these as `NEXT_PUBLIC_*`.

## Run

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
npm run start
```

Image generation is intentionally not included in this rebuild.
