import { Wordmark } from "@/components/brand/Wordmark";
import { getProfile, getSessionUser } from "@/lib/auth";
import Link from "next/link";

export async function SiteNav() {
  const user = await getSessionUser();
  const profile = user ? await getProfile() : null;
  const handle =
    (profile as { handle?: string } | null)?.handle ?? "you";

  return (
    <nav className="sticky top-0 z-40 border-b border-rule bg-base/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-[var(--nav-h)] items-center justify-between gap-[var(--space-4)] px-[var(--page-pad-x)] pr-[var(--page-pad-r)] pt-[env(safe-area-inset-top)]">
        <Link href="/" className="shrink-0">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-[var(--space-4)] type-meta text-muted sm:gap-[var(--space-5)]">
          <a
            href="/#play"
            className="hidden touch-target items-center text-verdict hover:text-ink sm:inline-flex"
          >
            detect
          </a>
          <Link
            href="/cinema/demo"
            className="touch-target inline-flex items-center hover:text-ink"
          >
            demo
          </Link>
          <Link
            href="/ladder"
            className="hidden touch-target items-center hover:text-ink md:inline-flex"
          >
            ladder
          </Link>
          {user ? (
            <>
              <Link
                href="/me"
                className="hidden touch-target items-center hover:text-ink md:inline-flex"
              >
                daily
              </Link>
              {(profile as { role?: string } | null)?.role === "ops" && (
                <Link
                  href="/ops"
                  className="touch-target inline-flex items-center text-verdict hover:text-ink"
                >
                  ops
                </Link>
              )}
              <Link
                href="/settings"
                className="touch-target inline-flex max-w-[9rem] items-center truncate text-breaker hover:text-ink"
              >
                @{handle}
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="touch-target inline-flex items-center text-breaker hover:text-ink"
            >
              sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
