import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.json(
      {
        error: "Supabase configuration is missing.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    url: supabaseUrl,
    publishableKey: supabasePublishableKey,
  });
}