import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const body = (await req.json()) as { handle?: string };
  const handle = (body.handle ?? "").trim().toLowerCase();
  if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (target.id === user.id) {
    return NextResponse.json({ error: "cannot_follow_self" }, { status: 400 });
  }

  const { error } = await supabase.from("follows").upsert({
    follower_id: user.id,
    following_id: target.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const body = (await req.json()) as { handle?: string };
  const handle = (body.handle ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", target.id);
  return NextResponse.json({ ok: true });
}
