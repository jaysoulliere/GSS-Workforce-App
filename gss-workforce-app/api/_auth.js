// Shared auth helper for Vercel serverless functions.
// Verifies the Supabase JWT supplied in `Authorization: Bearer <token>`.
//
// Env vars required:
//   SUPABASE_URL              (e.g. https://abcd1234.supabase.co)
//   SUPABASE_ANON_KEY         (the public anon key — used to validate user tokens)

import { createClient } from "@supabase/supabase-js";

export async function requireUser(req, res) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return null;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return null;
  }
  return data.user;
}

export function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
