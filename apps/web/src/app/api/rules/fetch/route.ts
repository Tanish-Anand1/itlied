import { extractRulesBody } from "@/lib/lies";
import { NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "raw.githubusercontent.com",
  "gist.githubusercontent.com",
  "github.com",
]);

/** Fetch public Cursor/Claude rules from a URL (GitHub raw / blob). */
export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const rawUrl = (body.url ?? "").trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "url_required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json(
      {
        error: "host_not_allowed",
        message: "Only GitHub raw/blob/gist HTTPS URLs.",
      },
      { status: 400 },
    );
  }

  let fetchUrl = parsed.toString();
  // github.com/owner/repo/blob/branch/path → raw
  if (parsed.hostname === "github.com") {
    const m = parsed.pathname.match(
      /^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/,
    );
    if (!m) {
      return NextResponse.json(
        { error: "need_blob_or_raw", message: "Use a /blob/… or raw.githubusercontent.com URL." },
        { status: 400 },
      );
    }
    fetchUrl = `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
  }

  try {
    const res = await fetch(fetchUrl, {
      headers: { Accept: "text/plain,*/*", "User-Agent": "ItLied-rules-fetch" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "fetch_failed", status: res.status },
        { status: 502 },
      );
    }
    const text = await res.text();
    if (text.length > 200_000) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }
    const rules = extractRulesBody(text);
    if (rules.length < 20) {
      return NextResponse.json({ error: "empty_rules" }, { status: 422 });
    }
    return NextResponse.json({
      rules,
      source: fetchUrl,
      chars: rules.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch_error" },
      { status: 502 },
    );
  }
}
