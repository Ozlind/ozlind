OZLIND AI — Next.js New Interface
This rebuild replaces the old OZLIND frontend with the supplied new index.html interface, converted to React/Next.js.
Structure
app/page.jsx — page entry
app/layout.jsx — metadata and document shell
app/globals.css — supplied new interface CSS
components/OzlindApp.jsx — new interface and client interactions
app/api/chat/route.js — real streaming AI endpoint
app/api/research/route.js — Tavily research endpoint
lib/providers.js — server-side provider routing
lib/server.js — request validation and prompt utilities
Environment variables
Set the variables in .env.local locally or Vercel Environment Variables:
GROQ_API_KEY
GROQ_MODEL
GEMINI_API_KEY
GEMINI_TEXT_MODEL
EXPERIENTIAL_API_KEY
EXPERIENTIAL_MODEL
TAVILY_API_KEY
Never expose these as NEXT_PUBLIC_*.
Run
npm install
npm run dev
Production:
npm run build
npm run start
Image generation is intentionally not included in this rebuild.
Supabase Authentication
Ozlind uses Supabase Authentication for Google sign-in.
Required environment variables (set in Vercel Environment Variables or .env.local):
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
These are read server-side (middleware, lib/supabase/server.js) and exposed to the
browser at runtime through /api/supabase/config — do NOT rename them to
NEXT_PUBLIC_*, the code does not read that prefix.
Never expose SUPABASE_SERVICE_ROLE_KEY or provider API keys to the browser.

Also required for Google sign-in to actually complete (not code — dashboard config):
- Google Cloud Console → OAuth Client → Authorized redirect URIs must include:
  https://<your-domain>/auth/callback
- Supabase Dashboard → Authentication → URL Configuration → Site URL and
  Redirect URLs must include your deployed domain and the /auth/callback path.