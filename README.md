# OZLIND AI

A focused, mobile-first AI workspace for conversation, web research and vision.

## Included
- Groq primary text routing
- Gemini multimodal/vision routing
- Experiential optional fallback
- Tavily live research
- Server-side API keys only
- Local conversation history with search/export/import
- Image attachments
- Copy, edit, regenerate and delete actions
- Custom model picker
- Response length/style, memory and custom instructions
- Responsive mobile-first UI
- Exact supplied OZLIND SVG identity system

## Intentionally not included yet
Image generation, photo editing, code assistant, documents and voice AI remain NEXT modules. OpenRouter is not part of the architecture.

## Environment
Copy `.env.example` to `.env` for local development. Never commit real keys. On Vercel, add the same server-side variables in Project Settings.

## Deployment
The app is a static frontend plus the Vercel-compatible `api/chat.js` serverless function. No build step or package installation is required.

## Verification
The release package is syntax-checked for both JavaScript files, checked for required DOM hooks, checked for OpenRouter removal, and validated for the supplied SVG symbol IDs. Real provider calls still require valid user-owned credentials in the deployment environment.
