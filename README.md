# OZLIND AI

OZLIND AI is a compact Next.js App Router AI workspace for chat, research, vision/file understanding, and image generation.

## Structure

```text
app/
├── api/
│   └── route.js
├── globals.css
├── layout.jsx
└── page.jsx

.env.example
.gitignore
.nvmrc
next.config.mjs
package.json
verify.js
README.md
```

The single API Route Handler uses an `action` query parameter for chat, research, and image generation. This intentionally keeps the project short without using an invalid flattened Next.js structure.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Add only the server-side keys you actually use.
3. Run `npm install`.
4. Run `npm run verify`.
5. Run `npm run dev`.

## Production

```bash
npm run build
npm start
```

## Product behavior

- Provider names are not exposed in the normal UI.
- Simple requests use efficient text routing.
- Reasoning requests can use the stronger configured capability.
- Vision/document attachments require a configured multimodal capability.
- Research performs server-side retrieval and returns structured sources.
- Image mode uses the configured image-generation capability.
- Temporary provider failures may use a compatible fallback; invalid requests and configuration failures are not silently masked.
- Conversation history and preferences are device-local.

## Important

The uploaded source archive did not contain an actual OZLIND SVG asset. The existing OZLIND mark styling was therefore preserved rather than inventing a replacement asset. If your GitHub project contains the canonical SVG, place that asset in `public/` and integrate it without changing its identity.
