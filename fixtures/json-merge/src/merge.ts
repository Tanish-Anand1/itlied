/**
 * Deep-merge utility.
 *
 * BUG: nested objects are replaced wholesale instead of merged, so
 * merge({a:{x:1}}, {a:{y:2}}) drops x. Visible tests only check shallow keys.
 */

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export function isObject(v: Json): v is { [key: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function merge(a: Json, b: Json): Json {
  if (!isObject(a) || !isObject(b)) return b;
  const out: { [key: string]: Json } = { ...a };
  for (const key of Object.keys(b)) {
    // BUG: should deep-merge when both sides are objects — uses overwrite instead.
    out[key] = b[key];
  }
  return out;
}
