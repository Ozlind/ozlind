import { json, requestId } from "@/lib/backend/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const id = requestId();

  return json(
    {
      status: "ok",
      service: "ozlind-api",
      version: "v1",
      timestamp: new Date().toISOString(),
    },
    200,
    {
      "Cache-Control": "no-store",
      "X-OZLIND-Request-ID": id,
    },
  );
}
