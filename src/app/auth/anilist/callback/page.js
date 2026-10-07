"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export default function AniListCallbackPage() {
  const [message, setMessage] = useState("Finishing AniList sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const error = hash.get("error");

      if (error) {
        window.location.replace(`/auth/error?error=${encodeURIComponent(error)}`);
        return;
      }

      if (!accessToken) {
        setMessage("AniList did not return an access token.");
        return;
      }

      window.history.replaceState(null, "", window.location.pathname);

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
      if (!cancelled) setMessage("Kage could not finish AniList sign-in.");
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
