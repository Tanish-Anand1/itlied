import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createService } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

/** List conversations or open/create a 1:1 DM. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("profile_id", user.id);

  const ids = (memberships ?? []).map((m) => m.conversation_id);
  if (!ids.length) return NextResponse.json({ conversations: [] });

  const { data: members } = await supabase
    .from("conversation_members")
    .select("conversation_id, profile_id, profiles(handle, display_name)")
    .in("conversation_id", ids);

  const conversations = ids.map((id) => {
    const others = (members ?? []).filter(
      (m) => m.conversation_id === id && m.profile_id !== user.id,
    );
    return { id, members: others };
  });

  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const body = (await req.json()) as {
    handle?: string;
    conversation_id?: string;
    message?: string;
  };

  const supabase = await createClient();

  if (body.conversation_id && body.message) {
    const text = body.message.trim();
    if (text.length < 1 || text.length > 4000) {
      return NextResponse.json({ error: "invalid_message" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: body.conversation_id,
        sender_id: user.id,
        body: text,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: data });
  }

  const handle = (body.handle ?? "").trim().toLowerCase();
  if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });

  const { data: other } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .maybeSingle();
  if (!other) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("profile_id", user.id);
  const myIds = new Set((mine ?? []).map((m) => m.conversation_id));
  const { data: theirs } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("profile_id", other.id);
  const shared = (theirs ?? []).find((m) => myIds.has(m.conversation_id));

  if (shared) {
    return NextResponse.json({ conversation_id: shared.conversation_id });
  }

  const svc = createService();
  const { data: conv, error: cErr } = await svc
    .from("conversations")
    .insert({})
    .select("id")
    .single();
  if (cErr || !conv) {
    return NextResponse.json({ error: cErr?.message ?? "create failed" }, { status: 500 });
  }

  await svc.from("conversation_members").insert([
    { conversation_id: conv.id, profile_id: user.id },
    { conversation_id: conv.id, profile_id: other.id },
  ]);

  if (body.message?.trim()) {
    await svc.from("messages").insert({
      conversation_id: conv.id,
      sender_id: user.id,
      body: body.message.trim(),
    });
  }

  return NextResponse.json({ conversation_id: conv.id });
}
