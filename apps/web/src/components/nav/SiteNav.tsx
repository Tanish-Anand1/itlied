import { Wordmark } from "@/components/brand/Wordmark";
import { getProfile, getSessionUser } from "@/lib/auth";
import Link from "next/link";

export async function SiteNav() {
  const user = await getSessionUser();
  const profile = user ? await getProfile() : null;
  const handle =
    (profile as { handle?: string } | null)?.handle ?? "you";

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-rule bg-base/75 px-4 py-2.5 backdrop-blur-xl backdrop-saturate-150">
      <Link href="/" className="shrink-0">
        <Wordmark size="sm" />
      </Link>
      <div className="flex items-center gap-4 font-mono text-[12px] text-muted">
        <a href="/#play" className="hidden text-verdict hover:text-ink sm:inline">
          detect
        </a>
        <Link href="/cinema/demo" className="hover:text-ink">
          demo
        </Link>
        <Link href="/ladder" className="hidden hover:text-ink sm:inline">
          ladder
        </Link>
        {user ? (
          <>
            <Link href="/me" className="hidden hover:text-ink md:inline">
              daily
            </Link>
            {(profile as { role?: string } | null)?.role === "ops" && (
              <Link href="/ops" className="text-verdict hover:text-ink">
                ops
              </Link>
            )}
            <Link href="/settings" className="text-breaker hover:text-ink">
              @{handle}
            </Link>
          </>
        ) : (
          <Link href="/login" className="text-breaker hover:text-ink">
            sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
