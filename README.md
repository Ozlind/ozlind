# OZLIND AI — Next.js V1

This release migrates OZLIND from the static HTML/CSS/JS shell to a Next.js App Router project while preserving the existing chat UX and API provider routing.

## What changed
- Next.js + React App Router structure.
- OZLIND SVG symbol library is served as a cached external sprite at `/ozlind-icons.svg`, reducing duplicated inline SVG markup.
- Pollinations has been removed completely.
- In-chat image generation now uses the Gemini API image-generation endpoint through `GEMINI_IMAGE_MODEL`.
- Groq, Gemini, Experiential and Tavily remain server-side.
- Security headers and a restrictive CSP are configured in `next.config.mjs`.
- Existing local chat history/settings UX is preserved.

## Environment
Copy `.env.example` to `.env.local` and set your existing server-side keys.

`GEMINI_IMAGE_MODEL` defaults to `gemini-2.5-flash-image`. Google currently documents Gemini image generation models separately from standard text models; image generation availability/pricing depends on the API account and model.

## Run
```bash
npm install
npm run dev
```

Production:
```bash
npm run build
npm start
```
