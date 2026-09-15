# Migration notes

## Previous architecture
`index.html` + `style.css` + `chatbot.js` + `api/*.js` was a static frontend/serverless architecture. It was working but had a monolithic DOM controller, inconsistent CORS, weak abuse controls, inline handlers, and limited automated verification.

## Why this release is different
The application is now a real Next.js App Router application:
- `/app/page.jsx` is the root route.
- `/app/components/OzlindApp.jsx` owns client UI/state.
- `/app/api/*/route.js` owns server endpoints.
- `/app/lib/*` contains reusable server/provider logic.
- `/public/ozlind-icons.svg` is the external sprite.

This removes the previous React/DOM ownership conflict and avoids mixing `app/` pages with `pages/api` routes.

## Deliberate changes
- No OpenRouter.
- No Pollinations.
- No separate image-generator page.
- Image generation is triggered from chat intent and uses Gemini server-side.
- Research is triggered from the chat Research control and uses Tavily server-side.
- Rate limiting is in-memory and therefore per deployment instance; for multi-instance production abuse protection, replace it with a shared store/firewall later.
