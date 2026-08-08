import { Wordmark } from "@/components/brand/Wordmark";
import { getProfile, getSessionUser } from "@/lib/auth";
import Link from "next/link";

export async function SiteNav() {
  const user = await getSessionUser();
  const profile = user ? await getProfile() : null;

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-rule bg-base/70 px-4 py-2.5 backdrop-blur-xl backdrop-saturate-150">
      <Link href="/" className="shrink-0">
        <Wordmark size="sm" />
      </Link>
      <div className="flex items-center gap-3 overflow-x-auto font-mono text-[12px] text-muted sm:gap-4">
        <a href="/#play" className="shrink-0 text-verdict hover:text-ink">
          detect
        </a>
        <Link href="/cinema/demo" className="shrink-0 text-breaker hover:text-ink">
          cinema
        </Link>
        <Link href="/ladder" className="shrink-0 hover:text-ink">
          ladder
        </Link>
        <Link href="/seasons" className="shrink-0 hover:text-ink">
          seasons
        </Link>
        {user ? (
          <>
            <Link href="/messages" className="shrink-0 hover:text-ink">
              messages
            </Link>
            <Link href="/me" className="shrink-0 hover:text-ink">
              daily
            </Link>
            {profile && (profile as { role?: string }).role === "ops" && (
              <Link href="/ops" className="shrink-0 text-verdict hover:text-ink">
                ops
              </Link>
            )}
            <Link
              href="/settings"
              className="shrink-0 text-breaker hover:text-ink"
            >
              @{(profile as { handle?: string } | null)?.handle ?? "settings"}
            </Link>
          </>
        ) : (
          <Link href="/login" className="shrink-0 text-breaker hover:text-ink">
            sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
