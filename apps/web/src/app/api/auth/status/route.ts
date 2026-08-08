import { NextResponse } from "next/server";

/**
 * Lightweight auth backend probe for the login UI.
 * Does not expose secrets — only provider availability flags.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({
      ok: false,
      reachable: false,
      email: false,
      google: false,
      github: false,
      mailpit: null as string | null,
      message: "Supabase env missing",
    });
  }

  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        reachable: false,
        email: false,
        google: false,
        github: false,
        mailpit: localMailpit(url),
        message: `auth settings ${res.status}`,
      });
    }
    const data = (await res.json()) as {
      external?: Record<string, boolean>;
    };
    const external = data.external ?? {};
    return NextResponse.json({
      ok: true,
      reachable: true,
      email: Boolean(external.email),
      google: Boolean(external.google),
      github: Boolean(external.github),
      mailpit: localMailpit(url),
      message: null,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      reachable: false,
      email: false,
      google: false,
      github: false,
      mailpit: localMailpit(url),
      message: err instanceof Error ? err.message : "unreachable",
    });
  }
}

function localMailpit(supabaseUrl: string): string | null {
  try {
    const u = new URL(supabaseUrl);
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
      return "http://127.0.0.1:54324";
    }
  } catch {
    /* ignore */
  }
  return null;
}
