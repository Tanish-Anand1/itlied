import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Only same-origin relative paths; block open redirects. */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  const next = raw.trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/";
  }
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl.includes("YOUR_PROJECT")
  ) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("auth_not_configured")}&next=${encodeURIComponent(next)}`,
    );
  }

  try {
    const supabase = await createClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
      );
    }

    // Magic-link / email OTP hash flow
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type: type as "email" | "magiclink" | "signup" | "invite" | "recovery",
        token_hash: tokenHash,
      });
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
      );
    }

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("missing_auth_code")}&next=${encodeURIComponent(next)}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "auth_callback_failed";
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`,
    );
  }
}
