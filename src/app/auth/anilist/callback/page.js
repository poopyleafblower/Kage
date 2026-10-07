"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

function readCookie(name) {
  const prefix = `${name}=`;
  const item = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

export default function AniListCallbackPage() {
  const [message, setMessage] = useState("Finishing AniList sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const accessToken = readCookie("kage_anilist_access_token");

      document.cookie =
        "kage_anilist_access_token=; Max-Age=0; Path=/; Secure; SameSite=Lax";

      if (!accessToken) {
        window.location.replace("/auth/error?error=OAuthCallback");
        return;
      }

      const result = await signIn("anilist-token", {
        accessToken,
        redirect: false,
        callbackUrl: "/",
      });

      if (cancelled) return;

      if (result?.ok) {
        window.location.replace(result.url || "/");
        return;
      }

      const code = result?.error || "CredentialsSignin";
      window.location.replace(`/auth/error?error=${encodeURIComponent(code)}`);
    }

    finish().catch((error) => {
      console.error("AniList sign-in completion failed:", error);
      if (!cancelled) {
        setMessage("Kage could not finish AniList sign-in.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0f1115] text-white px-4">
      <div className="rounded-xl border border-white/10 bg-[#15181d] p-6 text-center">
        <p>{message}</p>
      </div>
    </main>
  );
}
