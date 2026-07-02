// Vercel serverless function that proxies SoSoValue Open API requests so the
// API key stays server-side and never ships in the Vite client bundle.
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

  // Vercel provides catch-all segments as an array (or a plain string when
  // there is only one segment).
  const { path, ...rest } = req.query;
  const segments = Array.isArray(path) ? path : [path].filter(Boolean);
  const upstreamPath = segments.join("/");

  // Security allowlist: this proxy only serves the SoSoValue ETF endpoints
  // this app uses (etfs, etfs/summary-history, etfs/{ticker}/market-snapshot).
  // Anything else is rejected so the public endpoint can't be used as an open
  // relay to arbitrary SoSoValue APIs on this project's quota.
  if (segments[0] !== "etfs") {
    res.status(400).json({ error: "Unsupported path" });
    return;
  }

  // Forward any other query params the client sent (symbol, country_code, limit, ...).
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) {
    if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
    else if (value !== undefined) query.append(key, value);
  }
  const qs = query.toString();
  const url = `${UPSTREAM_BASE}/${upstreamPath}${qs ? `?${qs}` : ""}`;

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
