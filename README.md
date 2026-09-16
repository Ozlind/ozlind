# OZLIND AI

OZLIND AI is a compact, independent AI workspace for conversation, research and creation.

## Setup
1. Copy `.env.example` to `.env.local`.
2. Add server-side provider keys for the capabilities you want.
3. Run `npm install`.
4. Run `npm run dev`.

## Production
`npm run build` then `npm start`.

## Architecture
The browser talks only to OZLIND API routes. The server orchestrates capability-aware provider selection, bounded fallbacks and normalized responses. Provider names and secrets are never part of the normal product UI.

Research uses web retrieval and returns structured sources. Image generation is isolated from chat.
