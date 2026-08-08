import { SiteNav } from "@/components/nav/SiteNav";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileActions } from "./ProfileActions";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (!profile) notFound();

  const user = await getSessionUser();
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, elo, wins, losses, is_public")
    .eq("owner_id", profile.id)
    .order("elo", { ascending: false })
    .limit(20);

  const agentList = agents ?? [];
  const agentIds = agentList.map((a: { id: string }) => a.id);
  const idList =
    agentIds.length > 0
      ? agentIds.join(",")
      : "00000000-0000-0000-0000-000000000000";

  const [{ data: matches }, { count: followers }, { count: following }] =
    await Promise.all([
      supabase
        .from("matches")
        .select("id, status, verdict, fixture_id, created_at, agent_a, agent_b")
        .or(`agent_a.in.(${idList}),agent_b.in.(${idList})`)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profile.id),
    ]);

  let isFollowing = false;
  if (user && user.id !== profile.id) {
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .maybeSingle();
    isFollowing = Boolean(data);
  }

  return (
    <main>
      <SiteNav />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="border border-rule bg-panel px-4 py-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            profile
          </p>
          <h1 className="mt-1 font-display text-3xl text-ink">
            @{profile.handle}
          </h1>
          {profile.display_name && (
            <p className="mt-1 font-body text-muted">{profile.display_name}</p>
          )}
          {profile.bio && (
            <p className="mt-3 font-body text-sm text-ink/80">{profile.bio}</p>
          )}
          <p className="mt-4 font-mono text-[12px] text-muted">
            {followers ?? 0} followers · {following ?? 0} following
          </p>
          {user && user.id !== profile.id && (
            <ProfileActions handle={profile.handle} following={isFollowing} />
          )}
        </header>

        <section className="mt-6 border border-rule">
          <h2 className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            agents
          </h2>
          <ul className="divide-y divide-rule font-mono text-[12px]">
            {(agentList ?? []).map((a: {
              id: string;
              name: string;
              elo: number;
              wins: number;
              losses: number;
            }) => (
              <li key={a.id} className="flex justify-between px-3 py-2">
                <span className="text-ink">{a.name}</span>
                <span className="text-muted">
                  elo {a.elo} · {a.wins}W/{a.losses}L
                </span>
              </li>
            ))}
            {!agentList.length && (
              <li className="px-3 py-4 text-muted">no agents yet</li>
            )}
          </ul>
        </section>

        <section className="mt-6 border border-rule">
          <h2 className="border-b border-rule px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            recent matches
          </h2>
          <ul className="divide-y divide-rule font-mono text-[12px]">
            {(matches ?? []).map((m) => (
              <li key={m.id}>
                <Link
                  href={`/match/${m.id}`}
                  className="flex justify-between px-3 py-2 hover:bg-panel"
                >
                  <span className="text-breaker">{m.fixture_id}</span>
                  <span className="text-muted">
                    {m.verdict ?? m.status}
                  </span>
                </Link>
              </li>
            ))}
            {!matches?.length && (
              <li className="px-3 py-4 text-muted">no public matches</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
