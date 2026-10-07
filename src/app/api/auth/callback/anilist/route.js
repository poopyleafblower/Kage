import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const baseUrl = process.env.NEXTAUTH_URL || "https://kage-puce-beta.vercel.app";

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(oauthError)}`, baseUrl),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/error?error=OAuthCallback", baseUrl),
    );
  }

  const redirectUri = `${baseUrl}/api/auth/callback/anilist`;

  const response = await fetch("https://anilist.co/api/v2/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.ANILIST_CLIENT_ID,
      client_secret: process.env.ANILIST_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code,
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.access_token) {
    console.error("AniList token exchange failed", {
      status: response.status,
      error: payload?.error,
      message: payload?.message,
      hint: payload?.hint,
    });

    return NextResponse.redirect(
      new URL("/auth/error?error=OAuthCallback", baseUrl),
    );
  }

  const redirect = NextResponse.redirect(
    new URL("/auth/anilist/callback", baseUrl),
  );

  redirect.cookies.set("kage_anilist_access_token", payload.access_token, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 120,
  });

  return redirect;
}
