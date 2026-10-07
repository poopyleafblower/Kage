import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.ANILIST_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/auth/error?error=Configuration", process.env.NEXTAUTH_URL),
    );
  }

  const callback = `${process.env.NEXTAUTH_URL}/api/auth/callback/anilist`;
  const url = new URL("https://anilist.co/api/v2/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("redirect_uri", callback);

  return NextResponse.redirect(url);
}
