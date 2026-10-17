// POST /api/connect-accounts
// Lists (or deletes) Pipedream Connect accounts for the logged-in user.
//
// Body: {}                      → list this user's connected accounts
//       { account_id: "..." }   → delete that account (ownership is verified
//                                 against the user's account list first)
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

  const { account_id } = req.body || {};

  try {
    // Always fetch the user's own accounts — used for the list, and as an
    // ownership check before any delete.
    const accounts = await client.accounts.listByExternalUser(user.id);

    if (account_id) {
      const owned = (accounts || []).some((a) => a.id === account_id);
      if (!owned) {
        return res.status(404).json({ error: "Account not found for this user" });
      }
      await client.accounts.delete(account_id);
      return res.status(200).json({ deleted: account_id });
    }

    // Return a slimmed-down shape — never include credentials.
    const slim = (accounts || []).map((a) => ({
      id: a.id,
      app: a.app ? { name: a.app.name, nameSlug: a.app.nameSlug } : undefined,
      name: a.name,
      externalId: a.externalId,
      healthy: a.healthy,
      dead: a.dead,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
    return res.status(200).json({ accounts: slim });
  } catch (e) {
    return res.status(502).json({ error: `Pipedream accounts request failed: ${String(e?.message || e)}` });
  }
}
