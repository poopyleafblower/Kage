import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.ANILIST_CLIENT_ID;
  const baseUrl = process.env.NEXTAUTH_URL;

  if (!clientId || !baseUrl) {
    return NextResponse.redirect(
      new URL("/auth/error?error=Configuration", baseUrl || "https://kage-puce-beta.vercel.app"),
    );
  }

  const callback = `${baseUrl}/api/auth/callback/anilist`;
  const url = new URL("https://anilist.co/api/v2/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("response_type", "code");

  return NextResponse.redirect(url);
}
