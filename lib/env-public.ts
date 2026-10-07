import { z } from "zod";
const publicEnvSchema=z.object({NEXT_PUBLIC_SITE_URL:z.string().url().default("http://localhost:3000")});
export type PublicEnv=z.infer<typeof publicEnvSchema>;
let cached:PublicEnv|undefined;
export function getPublicEnv():PublicEnv{
  if(cached)return cached;
  const parsed=publicEnvSchema.safeParse({NEXT_PUBLIC_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL??process.env.SITE_URL});
  if(!parsed.success)throw new Error(`Invalid public environment: ${parsed.error.issues.map(i=>i.path.join(".")+" "+i.message).join("; ")}`);
  cached=parsed.data;return cached;
}
