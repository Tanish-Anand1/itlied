import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("match_id");
  if (!matchId) return NextResponse.json({ error: "match_id" }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("match_comments")
    .select("id, body, created_at, author_id, profiles(handle, display_name)")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true })
    .limit(200);

  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const body = (await req.json()) as { match_id?: string; body?: string };
  const matchId = body.match_id;
  const text = (body.body ?? "").trim();
  if (!matchId || text.length < 1 || text.length > 2000) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("match_comments")
    .insert({ match_id: matchId, author_id: user.id, body: text })
    .select("id, body, created_at, author_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data });
}
