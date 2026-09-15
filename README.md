# OZLIND AI — Next.js Pro Release

A clean App Router rebuild of OZLIND AI. This release intentionally removes the previous hybrid `dangerouslySetInnerHTML` + legacy `public/chatbot.js` bridge and the old `pages/api` layer.

## Active v1 capabilities
- AI chat with server-side Groq/Gemini/Experiential routing and fallback
- Server-side Tavily research mode
- In-chat Gemini image generation (no separate Image Generator page)
- Conversation history in localStorage with generated titles
- Message copy/edit/regenerate/delete actions
- Mobile-first responsive UI
- External cached SVG identity/icon sprite
- Conversation memory toggle, answer length/style and custom instructions
- In-memory request rate limiting and strict security headers

## Provider policy
OpenRouter and Pollinations are intentionally absent. Provider keys are server-only environment variables.

## Important image note
Gemini image generation access and pricing are separate from ordinary text-model access. A configured Gemini key may still need the required image-model access/billing for image output.

## Vercel
Root Directory must be the repository root. Framework should be detected as Next.js. Build command is `next build` and start command is `next start`.

Set these server-side variables:
- `GROQ_API_KEY`
- `GROQ_MODEL` (optional)
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional)
- `GEMINI_IMAGE_MODEL` (optional)
- `EXPERIENTIAL_API_KEY` (optional)
- `EXPERIENTIAL_MODEL` (optional)
- `TAVILY_API_KEY` (optional)
- `OZLIND_ALLOWED_ORIGIN` (optional exact production origin)

Do not use `NEXT_PUBLIC_` for provider secrets.

## Verification
Run `npm run verify` after installing dependencies. Run `npm run build` before production deployment.

The authoring environment used for this package could not complete `npm install` within its network timeout, so a local production build could not be executed here. Static Node syntax/structure checks are included in `tests/verify.js`.

## Vercel 404 prevention
This package includes `vercel.json` with the Next.js framework and `next build` command. Import the repository root; do not set `app/` or another subfolder as Root Directory. After changing the repository, wait for the new deployment to finish before testing the production URL.
