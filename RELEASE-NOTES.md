# OZLIND — Polished V1 Release Candidate

## Included

- Premium mobile-first workspace UI
- Fast opening experience with reduced-motion support
- Streaming AI chat
- Groq + Gemini + Experiential routing
- Tavily web research
- Vision attachments with in-chat previews
- Local history, search and import/export
- Memory and response-style settings
- Copy/edit/regenerate/delete message actions
- In-chat image generation
- Long image prompt support up to 4000 characters
- Provider safety request for generated images
- No OpenRouter dependency

## Image generation architecture

The chat UI detects explicit image-creation requests and calls `/api/image-generate`. Generated images are rendered in the same conversation with Download and Regenerate actions.

The provider remains isolated behind the API route so it can be replaced later without redesigning the chat UI.
