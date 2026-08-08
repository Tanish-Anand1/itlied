import { createClient } from "@/lib/supabase/server";

export async function getSessionUser() {
  try {
    const supabase = await createClient();
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000)),
    ]);
    if (!result) return null;
    return result.data.user ?? null;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) return null;
  return user;
}

export async function getProfile() {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return data;
}
