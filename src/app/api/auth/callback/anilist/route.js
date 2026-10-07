export const dynamic = "force-dynamic";

export async function GET() {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>Kage · AniList</title>
  </head>
  <body style="background:#0f1115;color:white;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0">
    <p>Finishing AniList sign-in…</p>
    <script>
      (function () {
        var hash = window.location.hash || "";
        window.location.replace("/auth/anilist/callback" + hash);
      })();
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
