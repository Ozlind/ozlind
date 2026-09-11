# OZLIND AI

OZLIND AI is a focused, mobile-first AI workspace.

## Included
- Groq as the primary text provider
- Gemini 3.6 Flash for multimodal/vision and fallback
- Experiential Labs as an optional fallback
- Tavily web research for current-information queries
- Local browser conversation history with search/export/import
- Image attachments and vision routing
- Copy, edit, regenerate and delete message actions
- Response length/style, memory and custom instructions
- Mobile navigation and responsive charcoal UI
- Light/dark theme

## Providers

## Environment
Copy `.env.example` to `.env` for local development and never commit real API keys.

The frontend calls `/api/chat`. On Vercel, `api/chat.js` is the serverless endpoint.

## Notes
Gemini 3.6 Flash is a stable supported Gemini API model. The API request intentionally does not send the deprecated Gemini temperature parameter.

## Verification
- JavaScript syntax checks pass for `chatbot.js` and `api/chat.js`.
- API SSE streaming was tested with mocked Groq and Gemini stream responses.
- Missing-provider/error handling was tested.
- Static HTTP serving and required DOM IDs were checked.
- OpenRouter references are absent from application code and environment configuration.

A full real-provider browser/API test requires the user's deployed Vercel environment and valid server-side API keys; those credentials are intentionally not bundled in this ZIP.
