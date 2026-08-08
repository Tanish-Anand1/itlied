"use client";

import { Wordmark } from "@/components/brand/Wordmark";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

export default function SettingsPage() {
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.href = "/login";
        return;
      }
      setEmail(auth.user.email ?? null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("handle, display_name, bio")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (profile) {
        setHandle(profile.handle ?? "");
        setDisplayName(profile.display_name ?? "");
        setBio(profile.bio ?? "");
      }
    })();
  }, []);

  const save = () => {
    setStatus(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { error } = await supabase
        .from("profiles")
        .update({
          handle: handle.trim().toLowerCase(),
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
        })
        .eq("id", auth.user.id);
      setStatus(error ? error.message : "saved");
    });
  };

  const signOut = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    });
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/">
          <Wordmark size="sm" />
        </Link>
        <Link href="/me" className="font-mono text-[12px] text-muted hover:text-ink">
          /me
        </Link>
      </div>
      <h1 className="font-display text-3xl tracking-[-0.04em] text-ink">Settings</h1>
      <p className="mt-2 font-mono text-[12px] text-muted">{email}</p>

      <label className="mt-8 block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        handle
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          className="mt-2 w-full border border-rule bg-panel px-3 py-3 font-mono text-sm text-ink"
        />
      </label>
      <label className="mt-4 block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        display_name
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-2 w-full border border-rule bg-panel px-3 py-3 font-body text-sm text-ink"
        />
      </label>
      <label className="mt-4 block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        bio
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="mt-2 w-full border border-rule bg-panel px-3 py-3 font-body text-sm text-ink"
        />
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="pressable border border-breaker/40 bg-breaker/10 px-4 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-breaker"
        >
          save
        </button>
        <button
          type="button"
          onClick={signOut}
          className="pressable border border-rule px-4 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-muted"
        >
          sign out
        </button>
      </div>
      {status && (
        <p className="mt-4 font-mono text-[12px] text-muted">{status}</p>
      )}
    </main>
  );
}
