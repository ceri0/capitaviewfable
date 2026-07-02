// Vercel serverless function that proxies SoSoValue Open API requests so the
// API key stays server-side and never ships in the Vite client bundle.
//
// Deliberately a FLAT function (no dynamic [...path] route): Vercel's
// catch-all dynamic function routing under a subfolder (api/soso/[...path].js)
// was verified live to only match a single path segment reliably and to
// 404 at the platform routing layer for anything nested deeper (e.g.
// /api/soso/etfs/summary-history never reached the function at all, even
// though the function itself built and deployed correctly — confirmed via
// the Vercel dashboard's Resources and Runtime Logs). A flat file always
// matches its own bare path with no ambiguity, so the client instead sends
// the desired SoSoValue sub-path + query string as a single `target` query
// parameter, e.g.:
//   /api/soso?target=etfs%2Fsummary-history%3Fsymbol%3DBTC%26country_code%3DUS
//
// LOCAL DEV NOTE: a plain `npm run dev` (Vite dev server) does NOT run this
// function — Vercel /api routes only work via `vercel dev` (which runs the
// Vite frontend AND emulates serverless functions together) or on an actual
// Vercel deployment. For `vercel dev`, put SOSOVALUE_API_KEY=... in `.env`
// (or `.env.local`); for deployments, set SOSOVALUE_API_KEY in the Vercel
// project's Environment Variables dashboard. No VITE_ prefix — that would
// expose it to the client again.

const UPSTREAM_BASE = "https://openapi.sosovalue.com/openapi/v1";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.SOSOVALUE_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "SOSOVALUE_API_KEY is not configured on the server. Set it in the Vercel project's environment variables (no VITE_ prefix).",
    });
    return;
  }

  const target = typeof req.query.target === "string" ? req.query.target : "";
  // Strip any accidental leading slash, then split path from query string.
  const cleaned = target.replace(/^\/+/, "");
  const [upstreamPath] = cleaned.split("?");

  // Security allowlist: only forward requests whose path starts with
  // "etfs" (the only SoSoValue module this app uses), so this proxy can't
  // be used as an open relay to arbitrary SoSoValue endpoints on this
  // project's rate limit/quota.
  if (!upstreamPath || !upstreamPath.startsWith("etfs")) {
    res.status(400).json({ error: "Unsupported path" });
    return;
  }

  const url = `${UPSTREAM_BASE}/${cleaned}`;

  try {
    const upstream = await fetch(url, {
      headers: { "x-soso-api-key": apiKey },
    });
    // Pass the upstream status code and JSON body through as-is so the
    // client-side error handling (res.status / json.code checks) keeps working.
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json"
    );
    res.send(body);
  } catch (err) {
    res
      .status(502)
      .json({ error: `Upstream request failed: ${err?.message || String(err)}` });
  }
}
