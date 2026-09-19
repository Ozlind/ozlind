# OZLIND AI

Production-oriented Next.js App Router frontend and server route for a focused AI workspace.

## Included

- AI conversation with SSE streaming
- Auto / Fast / Pro / Vision / Research modes
- Groq, Gemini and Experiential server-side routing
- Tavily-backed research mode
- Image/PDF/text/CSV attachments through Gemini capability routing
- Local conversation history and settings
- Memory toggle and custom instructions
- Copy, edit, regenerate, delete, stop and clear
- Responsive mobile navigation
- Source favicon cards for research results
- No image generation feature

## Run

```bash
npm install
npm run dev
```

Required provider keys belong only in server environment variables. Never expose them as `NEXT_PUBLIC_*` values.

The project intentionally keeps the API at `/api` because the route file is `app/api/route.js`.
