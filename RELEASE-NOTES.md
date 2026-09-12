# OZLIND AI — Clean Release

## Engineering changes
1. Rebuilt the responsive layout around a stable desktop/mobile grid.
2. Replaced the native model selector with a custom accessible picker.
3. Removed OpenRouter from the UI and configuration.
4. Replaced text/emoji UI glyphs with the supplied OZLIND SVG vocabulary.
5. Added turn-aware edit/delete/regenerate behavior.
6. Added safe lightweight Markdown rendering without injecting raw model HTML.
7. Added research evidence handling with untrusted-source instructions and source metadata.
8. Added deterministic OZLIND identity responses.
9. Added mobile viewport/safe-area handling.
10. Kept API keys server-side and preserved Groq/Gemini/Experiential/Tavily architecture.

## Verification boundary
No software can honestly be called guaranteed bug-free without testing against the actual deployed Vercel environment, real provider credentials, network conditions and target devices. This package is therefore release-clean and statically validated, with real-provider verification explicitly dependent on deployment credentials.
