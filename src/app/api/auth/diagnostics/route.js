import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null;

  return NextResponse.json(
    {
      app: "Kage",
      nextAuthUrlConfigured: Boolean(process.env.NEXTAUTH_URL),
      nextAuthSecretConfigured: Boolean(process.env.NEXTAUTH_SECRET),
      aniListClientIdConfigured: Boolean(process.env.ANILIST_CLIENT_ID),
      aniListClientSecretConfigured: Boolean(process.env.ANILIST_CLIENT_SECRET),
      graphQlEndpointConfigured: Boolean(process.env.GRAPHQL_ENDPOINT),
      expectedCallback:
        "https://kage-puce-beta.vercel.app/api/auth/callback/anilist",
      configuredNextAuthUrl: process.env.NEXTAUTH_URL || null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
