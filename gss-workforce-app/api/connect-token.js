// POST /api/connect-token
// Mints a short-lived Pipedream Connect token for the logged-in user.
//
// The Supabase user ID is used as the external_user_id, so each logged-in
// manager's connected accounts are scoped to them. The client-supplied
// external_user_id (if any) is ignored — identity always comes from the
// verified Supabase session.
//
// Env vars: see api/_pipedream.js

import { requireUser, applyCors } from "./_auth.js";
import { pipedreamClient, PIPEDREAM_NOT_CONFIGURED } from "./_pipedream.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const client = pipedreamClient();
  if (!client) {
    return res.status(500).json({ error: PIPEDREAM_NOT_CONFIGURED });
  }

  try {
    const { token, expiresAt, connectLinkUrl } = await client.tokens.create({
      externalUserId: user.id,
    });
    return res.status(200).json({ token, expiresAt, connectLinkUrl });
  } catch (e) {
    return res.status(502).json({ error: `Pipedream token creation failed: ${String(e?.message || e)}` });
  }
}
