# OZLIND AI

Premium mobile-first AI workspace UI for OZLIND AI.

## Included
- AI chat with Groq, Gemini, Experiential Labs and optional OpenRouter routing
- Tavily web research
- Image attachments / vision routing to Gemini
- Browser conversation history, search, export/import
- Response settings, memory toggle and custom instructions
- Mobile navigation, safe-area composer, keyboard-friendly layout
- Subtle message, typing, loading and interaction animations
- Mature charcoal design system with light/dark theme support

## Environment
Copy `.env.example` to `.env` for local use. Never commit real API keys.

The current frontend calls `/api/chat`; Vercel deploys `api/chat.js` as the serverless endpoint.
