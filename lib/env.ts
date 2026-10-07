import { z } from "zod";
const serverEnvSchema=z.object({
  GROQ_API_KEY:z.string().min(1).optional(),OPENROUTER_API_KEY:z.string().min(1).optional(),
  GROQ_FAST_MODEL:z.string().min(1).default("openai/gpt-oss-20b"),GROQ_PRO_MODEL:z.string().min(1).default("openai/gpt-oss-120b"),OPENROUTER_MODEL:z.string().min(1).optional(),
  GEMINI_API_KEY:z.string().min(1).optional(),GEMINI_MODEL:z.string().min(1).optional(),TAVILY_API_KEY:z.string().min(1).optional(),EMBEDDING_MODEL:z.string().min(1).optional(),
  SUPABASE_URL:z.string().url().optional(),SUPABASE_PUBLISHABLE_KEY:z.string().min(1).optional(),SUPABASE_SECRET_KEY:z.string().min(1).optional(),
  SITE_URL:z.string().url().default("http://localhost:3000"),SENTRY_DSN:z.string().url().optional(),TURNSTILE_SITE_KEY:z.string().min(1).optional(),TURNSTILE_SECRET_KEY:z.string().min(1).optional()
});
export type ServerEnv=z.infer<typeof serverEnvSchema>;
let cached:ServerEnv|undefined;
export function getServerEnv():ServerEnv{
  if(cached)return cached;
  const parsed=serverEnvSchema.safeParse(process.env);
  if(!parsed.success)throw new Error(`Invalid server environment: ${parsed.error.issues.map(i=>i.path.join(".")+" "+i.message).join("; ")}`);
  if(parsed.data.SUPABASE_SECRET_KEY&&parsed.data.SUPABASE_PUBLISHABLE_KEY&&parsed.data.SUPABASE_SECRET_KEY===parsed.data.SUPABASE_PUBLISHABLE_KEY)throw new Error("SUPABASE_SECRET_KEY must not equal SUPABASE_PUBLISHABLE_KEY.");
  cached=parsed.data;return cached;
}
export function requireEnv<K extends keyof ServerEnv>(key:K):NonNullable<ServerEnv[K]>{
  const value=getServerEnv()[key];if(value===undefined||value===null||value==="")throw new Error(`Missing required environment variable: ${String(key)}`);
  return value as NonNullable<ServerEnv[K]>;
}
