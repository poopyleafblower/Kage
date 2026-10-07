"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const messages = {
  OAuthSignin: "Kage could not start the AniList OAuth request.",
  OAuthCallback: "AniList returned to Kage, but the OAuth callback could not be completed.",
  OAuthCreateAccount: "AniList authenticated successfully, but Kage could not create the local account record.",
  Callback: "The AniList callback could not be completed.",
  Configuration: "Kage's authentication configuration is incomplete.",
  AccessDenied: "AniList authentication was denied.",
};

export default function AuthErrorPage() {
  const params = useSearchParams();
  const error = params.get("error") || "Unknown";
  const message = messages[error] || "AniList authentication failed.";

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[#0f1115] text-white">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#15181d] p-6 text-center">
        <h1 className="text-2xl font-semibold mb-3">AniList sign-in failed</h1>
        <p className="text-white/70 mb-3">{message}</p>
        <p className="text-xs text-white/50 mb-6">Error code: {error}</p>
        <div className="flex justify-center gap-3">
          <Link href="/" className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/15">
            Back to Kage
          </Link>
          <Link href="/api/auth/signin" className="px-4 py-2 rounded-md bg-[#4D148C] hover:bg-[#5f1aa9]">
            Try again
          </Link>
        </div>
      </div>
    </main>
  );
}
