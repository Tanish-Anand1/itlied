import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const body = (await req.json()) as {
    handle?: string;
    action?: "request" | "accept" | "block";
  };
  const handle = (body.handle ?? "").trim().toLowerCase();
  const action = body.action ?? "request";
  if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (target.id === user.id) {
    return NextResponse.json({ error: "cannot_friend_self" }, { status: 400 });
  }

  if (action === "request") {
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: target.id,
      status: "pending",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "pending" });
  }

  if (action === "accept") {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("requester_id", target.id)
      .eq("addressee_id", user.id)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "accepted" });
  }

  if (action === "block") {
    const { error } = await supabase.from("friendships").upsert({
      requester_id: user.id,
      addressee_id: target.id,
      status: "blocked",
      updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "blocked" });
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("friendships")
    .select("id, requester_id, status")
    .eq("addressee_id", user.id)
    .eq("status", "pending");

  const requesterIds = (pending ?? []).map((p) => p.requester_id);
  const { data: profiles } = requesterIds.length
    ? await supabase
        .from("profiles")
        .select("id, handle, display_name")
        .in("id", requesterIds)
    : { data: [] as Array<{ id: string; handle: string; display_name: string | null }> };

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return NextResponse.json({
    pending: (pending ?? []).map((p) => ({
      ...p,
      profiles: byId.get(p.requester_id) ?? null,
    })),
  });
}
